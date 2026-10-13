import { EXECUTION_CONTRACT_VERSION, type ExecutionRequest } from "./contract.ts";

export function makeRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    contract_version: EXECUTION_CONTRACT_VERSION,
    request_id: "req-1",
    objective: "Create a calendar event: team meeting tomorrow 15:00-16:00 WIB",
    context: [{ kind: "user_request", content: "besok jam 3 sore meeting sama tim" }],
    constraints: ["Use timezone Asia/Jakarta"],
    expected_output: { description: "The created event id and link" },
    permissions: [{ capability: "calendar.events.create", outward: true }],
    approval: { approved_by: "nanda", approved_at: "2026-10-13T10:00:00+07:00", confirmation_id: "abc123" },
    operational_state: { attempt: 1 },
    ...overrides,
  };
}
