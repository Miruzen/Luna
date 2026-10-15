import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import { delegate } from "../interface.ts";
import { makeRequest } from "../test_fixtures.ts";
import { buildQuery, JarvisAdapter } from "./adapter.ts";
import type { JarvisRunInput, JarvisRunOutput, JarvisTransport } from "./transport.ts";

// Mock Jarvis. Output shape mirrors OpenJarvis Jarvis.ask_full() agent mode (sdk.py:585-599).
class MockTransport implements JarvisTransport {
  inputs: JarvisRunInput[] = [];
  constructor(private output: JarvisRunOutput) {}
  run(input: JarvisRunInput) {
    this.inputs.push(input);
    return Promise.resolve(this.output);
  }
}

const capabilityTools = { "calendar.events.create": ["calendar_create_event"] };

Deno.test("jarvis: successful run maps to completed with actions and evidence", async () => {
  const transport = new MockTransport({
    content: "Event created",
    tool_results: [{ tool_name: "calendar_create_event", content: '{"id":"evt1"}', success: true }],
  });
  const res = await delegate(new JarvisAdapter({ transport, capabilityTools }), makeRequest());

  assertEquals(res.status, "completed");
  assertEquals(res.engine, "jarvis");
  assertEquals(res.result, "Event created");
  assertEquals(res.actions_taken, [{ action: "calendar_create_event", outcome: "succeeded", detail: '{"id":"evt1"}' }]);
  assertEquals(res.evidence.map((e) => e.kind), ["tool_output", "engine_response"]);
  assertEquals(transport.inputs[0].tools, ["calendar_create_event"]);
  assertEquals(transport.inputs[0].metadata, { request_id: "req-1", attempt: 1, session_id: undefined });
});

Deno.test("jarvis: unsupported capability is rejected without calling Jarvis", async () => {
  const transport = new MockTransport({ content: "", tool_results: [] });
  const res = await delegate(new JarvisAdapter({ transport, capabilityTools: {} }), makeRequest());

  assertEquals(res.status, "rejected");
  assertEquals(res.errors[0].code, "capability_not_supported");
  assertEquals(transport.inputs.length, 0);
});

Deno.test("jarvis: tool outside granted permissions is a permission violation", async () => {
  const transport = new MockTransport({
    content: "done",
    tool_results: [{ tool_name: "shell_exec", content: "rm -rf", success: true }],
  });
  const res = await delegate(new JarvisAdapter({ transport, capabilityTools }), makeRequest());

  assertEquals(res.status, "failed");
  assertEquals(res.errors[0].code, "permission_violation");
});

Deno.test("jarvis: Jarvis-side confirmation refusal escalates as needs_approval", async () => {
  const transport = new MockTransport({
    content: "",
    tool_results: [{
      tool_name: "calendar_create_event",
      content: "Tool 'calendar_create_event' requires confirmation but no confirmation callback is available.",
      success: false,
    }],
  });
  const res = await delegate(new JarvisAdapter({ transport, capabilityTools }), makeRequest());

  assertEquals(res.status, "needs_approval");
  assertEquals(res.errors[0].code, "engine_requested_approval");
});

Deno.test("jarvis: failed tool maps to failed, not retryable", async () => {
  const transport = new MockTransport({
    content: "",
    tool_results: [{ tool_name: "calendar_create_event", content: "Google 500", success: false }],
  });
  const res = await delegate(new JarvisAdapter({ transport, capabilityTools }), makeRequest());

  assertEquals(res.status, "failed");
  assertEquals(res.errors, [{ code: "tool_failed", message: "calendar_create_event: Google 500", retryable: false }]);
});

Deno.test("jarvis: transport error becomes a failed result via the interface", async () => {
  const transport: JarvisTransport = { run: () => Promise.reject(new Error("connection refused")) };
  const res = await delegate(new JarvisAdapter({ transport, capabilityTools }), makeRequest());

  assertEquals(res.status, "failed");
  assertEquals(res.errors[0].code, "engine_error");
});

Deno.test("jarvis: query carries only projected context, constraints and approval note", () => {
  const q = buildQuery(makeRequest());
  assertStringIncludes(q, "Objective: Create a calendar event");
  assertStringIncludes(q, "- [user_request] besok jam 3 sore meeting sama tim");
  assertStringIncludes(q, "- Use timezone Asia/Jakarta");
  assertStringIncludes(q, "Do not ask for confirmation.");
  assertFalse(buildQuery(makeRequest({ approval: null, permissions: [] })).includes("Do not ask for confirmation"));
});

Deno.test("jarvis: max-turns give-up is failed (retryable), never completed", async () => {
  const transport = new MockTransport({
    content: "Maximum turns reached without a final answer.",
    tool_results: [{ tool_name: "calendar_create_event", content: "partial", success: true }],
  });
  const res = await delegate(new JarvisAdapter({ transport, capabilityTools }), makeRequest());
  assertEquals(res.status, "failed");
  assertEquals(res.errors, [{ code: "engine_incomplete", message: "Jarvis stopped at its turn limit without finishing the task.", retryable: true }]);
});

Deno.test("jarvis: structured inputs are sent as JSON data, not re-written as prose", () => {
  const q = buildQuery(makeRequest({ inputs: { title: "TEST LUNA", start_datetime: "2026-10-16T16:00:00+07:00" } }));
  assertStringIncludes(q, "Inputs (use exactly these values):");
  assertStringIncludes(q, '"start_datetime": "2026-10-16T16:00:00+07:00"');
  assertFalse(buildQuery(makeRequest()).includes("Inputs (use exactly"));
});

Deno.test("jarvis: long tool output is truncated in evidence", async () => {
  const transport = new MockTransport({
    content: "ok",
    tool_results: [{ tool_name: "calendar_create_event", content: "x".repeat(2000), success: true }],
  });
  const res = await delegate(new JarvisAdapter({ transport, capabilityTools }), makeRequest());
  assert(res.evidence[0].description.length <= 501);
});
