// Execution Boundary contract (Stage 1). Engine-agnostic: nothing here may reference
// Jarvis or any other engine. See CLAUDE.md, docs/DECISIONS.md (ADR-004/005/008/012/013).

export const EXECUTION_CONTRACT_VERSION = "1";

// A capability LUNA grants for this request only, e.g. "calendar.events.create".
// `outward` marks actions that affect the world beyond LUNA (create, send, pay, ...);
// those require Nanda's recorded approval (ADR-012).
export interface Permission {
  capability: string;
  outward: boolean;
}

// Proof that Nanda confirmed this specific action. LUNA's approval authorizes the
// execution layer; it must not ask again (ADR-013).
export interface Approval {
  approved_by: "nanda";
  approved_at: string; // ISO 8601
  confirmation_id: string;
}

// Context explicitly projected by LUNA for this task. The execution layer gets this and
// nothing else, never LUNA's full memory (ADR-008).
export interface ContextItem {
  kind: string; // e.g. "user_request", "preference", "fact"
  content: string;
  source?: string; // where it came from, for audits, e.g. "work_item:<id>.args" (Stage 2, DEC-005)
}

export interface ExecutionRequest {
  contract_version: typeof EXECUTION_CONTRACT_VERSION;
  request_id: string; // unique per task; lets engines make retries idempotent
  objective: string;
  // Structured, already-validated task data (e.g. the calendar args Nanda approved). Engines use
  // these values exactly instead of re-interpreting prose (Stage 2, DEC-005).
  inputs?: Record<string, unknown>;
  context: ContextItem[];
  constraints: string[];
  expected_output: { description: string };
  permissions: Permission[];
  approval: Approval | null;
  operational_state: { attempt: number; session_id?: string };
}

export type ExecutionStatus =
  | "completed"
  | "failed"
  | "needs_approval" // needs a permission LUNA did not grant -> escalate to LUNA/Nanda
  | "needs_input" // needs information LUNA did not provide
  | "rejected"; // engine cannot or will not do this task at all

export const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  "completed", "failed", "needs_approval", "needs_input", "rejected",
];

export interface Evidence {
  kind: string; // e.g. "tool_output", "engine_response"
  description: string;
  ref?: string;
}

export interface ActionRecord {
  action: string;
  outcome: "succeeded" | "failed";
  detail?: string;
}

export interface Artifact {
  name: string;
  kind: string;
  uri?: string;
  content?: string;
}

export interface ExecutionError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ExecutionResult {
  contract_version: typeof EXECUTION_CONTRACT_VERSION;
  request_id: string;
  engine: string;
  status: ExecutionStatus;
  result: string | null;
  evidence: Evidence[];
  actions_taken: ActionRecord[];
  artifacts: Artifact[];
  errors: ExecutionError[];
  next_recommendation: string | null;
}

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

// LUNA-side guard: a request that fails here never reaches an engine.
export function validateExecutionRequest(req: ExecutionRequest): string[] {
  const errors: string[] = [];
  if (req?.contract_version !== EXECUTION_CONTRACT_VERSION) errors.push("unsupported contract_version");
  if (!nonEmpty(req?.request_id)) errors.push("request_id is required");
  if (!nonEmpty(req?.objective)) errors.push("objective is required");
  if (!nonEmpty(req?.expected_output?.description)) errors.push("expected_output.description is required");
  if (!Array.isArray(req?.context) || req.context.some((c) => !nonEmpty(c?.kind) || typeof c?.content !== "string")) {
    errors.push("context must be a list of {kind, content}");
  } else if (req.context.some((c) => c.source !== undefined && typeof c.source !== "string")) {
    errors.push("context source must be a string");
  }
  if (req?.inputs !== undefined && (req.inputs === null || typeof req.inputs !== "object" || Array.isArray(req.inputs))) {
    errors.push("inputs must be an object");
  }
  if (!Array.isArray(req?.constraints) || req.constraints.some((c) => typeof c !== "string")) {
    errors.push("constraints must be a list of strings");
  }
  if (!Array.isArray(req?.permissions) || req.permissions.some((p) => !nonEmpty(p?.capability) || typeof p?.outward !== "boolean")) {
    errors.push("permissions must be a list of {capability, outward}");
  } else if (req.permissions.some((p) => p.outward)) {
    const a = req.approval;
    if (!a || a.approved_by !== "nanda" || !nonEmpty(a.confirmation_id) || isNaN(Date.parse(a.approved_at))) {
      errors.push("outward permissions require Nanda's approval");
    }
  }
  if (!Number.isInteger(req?.operational_state?.attempt) || req.operational_state.attempt < 1) {
    errors.push("operational_state.attempt must be a positive integer");
  }
  return errors;
}

// Engine output is untrusted: check it before LUNA acts on it.
export function validateExecutionResult(res: ExecutionResult, req: ExecutionRequest): string[] {
  const errors: string[] = [];
  if (res?.contract_version !== EXECUTION_CONTRACT_VERSION) errors.push("unsupported contract_version");
  if (res?.request_id !== req.request_id) errors.push("request_id does not match the request");
  if (!EXECUTION_STATUSES.includes(res?.status)) errors.push("invalid status");
  for (const key of ["evidence", "actions_taken", "artifacts", "errors"] as const) {
    if (!Array.isArray(res?.[key])) errors.push(`${key} must be a list`);
  }
  if (res?.status === "failed" && Array.isArray(res.errors) && res.errors.length === 0) {
    errors.push("failed result must include at least one error");
  }
  return errors;
}
