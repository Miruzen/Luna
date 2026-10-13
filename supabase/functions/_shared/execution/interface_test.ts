import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { EXECUTION_CONTRACT_VERSION, type ExecutionRequest, type ExecutionResult, validateExecutionRequest } from "./contract.ts";
import { delegate, type ExecutionEngine } from "./interface.ts";
import { makeRequest } from "./test_fixtures.ts";

// A non-Jarvis engine: proves LUNA delegates through the interface without knowing the engine.
class FakeEngine implements ExecutionEngine {
  readonly id = "fake";
  calls = 0;
  constructor(private respond: (req: ExecutionRequest) => ExecutionResult | Promise<ExecutionResult>) {}
  execute(req: ExecutionRequest) {
    this.calls++;
    return Promise.resolve(this.respond(req));
  }
}

const ok = (req: ExecutionRequest): ExecutionResult => ({
  contract_version: EXECUTION_CONTRACT_VERSION,
  request_id: req.request_id,
  engine: "fake",
  status: "completed",
  result: "done",
  evidence: [],
  actions_taken: [],
  artifacts: [],
  errors: [],
  next_recommendation: null,
});

Deno.test("contract: valid request passes", () => {
  assertEquals(validateExecutionRequest(makeRequest()), []);
});

Deno.test("contract: outward permission without Nanda's approval is invalid", () => {
  const errors = validateExecutionRequest(makeRequest({ approval: null }));
  assertEquals(errors, ["outward permissions require Nanda's approval"]);
});

Deno.test("contract: non-outward permission needs no approval", () => {
  const req = makeRequest({ approval: null, permissions: [{ capability: "calendar.events.read", outward: false }] });
  assertEquals(validateExecutionRequest(req), []);
});

Deno.test("contract: missing objective and bad attempt are reported", () => {
  const errors = validateExecutionRequest(makeRequest({ objective: " ", operational_state: { attempt: 0 } }));
  assertEquals(errors, ["objective is required", "operational_state.attempt must be a positive integer"]);
});

Deno.test("delegate: valid request reaches the engine and returns its result", async () => {
  const engine = new FakeEngine(ok);
  const res = await delegate(engine, makeRequest());
  assertEquals(engine.calls, 1);
  assertEquals(res.status, "completed");
  assertEquals(res.result, "done");
});

Deno.test("delegate: invalid request is rejected and never reaches the engine", async () => {
  const engine = new FakeEngine(ok);
  const res = await delegate(engine, makeRequest({ approval: null }));
  assertEquals(engine.calls, 0);
  assertEquals(res.status, "rejected");
  assertEquals(res.errors[0].code, "invalid_request");
});

Deno.test("delegate: engine exception becomes a failed result (never throws)", async () => {
  const engine = new FakeEngine(() => {
    throw new Error("boom");
  });
  const res = await delegate(engine, makeRequest());
  assertEquals(res.status, "failed");
  assertEquals(res.errors[0].code, "engine_error");
  assertStringIncludes(res.errors[0].message, "boom");
});

Deno.test("delegate: engine result for a different request is refused", async () => {
  const engine = new FakeEngine((req) => ({ ...ok(req), request_id: "other" }));
  const res = await delegate(engine, makeRequest());
  assertEquals(res.status, "failed");
  assertEquals(res.errors[0].code, "invalid_engine_result");
});

Deno.test("delegate: failed result without errors is refused", async () => {
  const engine = new FakeEngine((req) => ({ ...ok(req), status: "failed" }));
  const res = await delegate(engine, makeRequest());
  assertEquals(res.errors[0].code, "invalid_engine_result");
});
