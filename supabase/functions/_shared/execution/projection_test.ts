import { assert, assertEquals } from "jsr:@std/assert@1";
import { type Approval, validateExecutionRequest } from "./contract.ts";
import { CALENDAR_CREATE_POLICY } from "./policies.ts";
import { type ProjectableWorkItem, projectContext } from "./projection.ts";
import { makeRequest } from "./test_fixtures.ts";

const approval: Approval = { approved_by: "nanda", approved_at: "2026-10-15T09:03:31+07:00", confirmation_id: "9559ae7d099544ffb530c9a3a3358d41" };
const args = {
  title: "TEST LUNA",
  start_datetime: "2026-10-16T16:00:00+07:00",
  end_datetime: "2026-10-16T16:15:00+07:00",
  timezone: "Asia/Jakarta",
};
const item = (over: Partial<ProjectableWorkItem> = {}): ProjectableWorkItem => ({
  id: "9559ae7d099544ffb530c9a3a3358d41",
  capability: "calendar.events.create",
  args,
  attempt: 1,
  session_id: "f0b9f54f-eb89-4a7b-a0a3-d979824c85df",
  ...over,
});

Deno.test("projection: valid calendar request carries exactly the approved inputs", () => {
  const r = projectContext(CALENDAR_CREATE_POLICY, item(), approval);
  assert(r.ok);
  assertEquals(r.request.inputs, args);
  assertEquals(r.request.request_id, "9559ae7d099544ffb530c9a3a3358d41");
  assertEquals(r.request.permissions, [{ capability: "calendar.events.create", outward: true }]);
  assertEquals(r.request.context, []);
  assertEquals(validateExecutionRequest(r.request), []); // passes the Stage 1 contract
});

Deno.test("projection: personal context, raw utterance and history are excluded by default", () => {
  const r = projectContext(CALENDAR_CREATE_POLICY, item(), approval, [
    { kind: "preference", content: "prefers 30-minute meetings", source: "memory:1" },
    { kind: "user_request", content: "besok jam 3 sore meeting sama tim", source: "conversation_turn:9" },
    { kind: "fact", content: "mother's birthday is 3 May", source: "memory:2" },
  ]);
  assert(r.ok);
  assertEquals(r.request.context, []);
  assertEquals(r.excluded.map((e) => e.kind), ["preference", "user_request", "fact"]);
});

Deno.test("projection: allowed context kinds pass through with their source", () => {
  const policy = { ...CALENDAR_CREATE_POLICY, allowedContextKinds: ["goal"] };
  const goal = { kind: "goal", content: "prepare the Q4 review", source: "mission:1" };
  const r = projectContext(policy, item(), approval, [goal, { kind: "fact", content: "x" }]);
  assert(r.ok);
  assertEquals(r.request.context, [goal]);
});

Deno.test("projection: undeclared args are not forwarded", () => {
  const r = projectContext(CALENDAR_CREATE_POLICY, item({ args: { ...args, internal_note: "secret" } }), approval);
  assert(r.ok);
  assertEquals("internal_note" in (r.request.inputs ?? {}), false);
});

Deno.test("projection: missing required input -> missing_context, nothing built", () => {
  const { start_datetime: _, ...partial } = args;
  assertEquals(projectContext(CALENDAR_CREATE_POLICY, item({ args: partial }), approval), {
    ok: false,
    error: "missing_context",
    fields: ["start_datetime"],
  });
});

Deno.test("projection: outward capability without approval -> missing_context", () => {
  assertEquals(projectContext(CALENDAR_CREATE_POLICY, item(), null), { ok: false, error: "missing_context", fields: ["approval"] });
});

Deno.test("projection: contradictory inputs are refused, never sent to the executor", () => {
  const r = projectContext(CALENDAR_CREATE_POLICY, item({ args: { ...args, end_datetime: "2026-10-16T15:00:00+07:00" } }), approval);
  assertEquals(r, { ok: false, error: "contradiction", fields: ["end must be after start"] });
});

Deno.test("projection: work item for another capability is refused", () => {
  assertEquals(projectContext(CALENDAR_CREATE_POLICY, item({ capability: "email.send" }), approval).ok, false);
});

Deno.test("contract: optional inputs/source stay backward compatible and are type-checked", () => {
  assertEquals(validateExecutionRequest(makeRequest()), []); // no inputs, no source: still valid
  // deno-lint-ignore no-explicit-any
  assertEquals(validateExecutionRequest(makeRequest({ inputs: [] as any })), ["inputs must be an object"]);
  // deno-lint-ignore no-explicit-any
  const badSource = makeRequest({ context: [{ kind: "goal", content: "x", source: 42 as any }] });
  assertEquals(validateExecutionRequest(badSource), ["context source must be a string"]);
});
