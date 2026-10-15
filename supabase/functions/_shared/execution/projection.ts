// Context Projection (Stage 2, Workstream 2). Deterministic code, not AI: it never interprets
// anything. It copies the already-approved inputs and keeps only the context a capability's
// policy allows (default deny). Design: stage-2/docs/CONTEXT_PROJECTION.md.
import {
  type Approval,
  type ContextItem,
  EXECUTION_CONTRACT_VERSION,
  type ExecutionRequest,
} from "./contract.ts";

export interface ProjectionPolicy {
  capability: string;
  outward: boolean; // affects the world -> requires Nanda's approval
  objective: string;
  expectedOutput: string;
  requiredInputs: string[];
  optionalInputs: string[];
  constraints: string[];
  allowedContextKinds: string[]; // personal/strategic context kinds the executor may get; usually none
  // Returns contradictions between inputs (e.g. end before start). Empty = consistent.
  findContradictions?: (inputs: Record<string, unknown>) => string[];
}

// The minimum a projection needs from a work item (kept independent of the DB layer).
export interface ProjectableWorkItem {
  id: string;
  capability: string;
  args: Record<string, unknown>;
  attempt: number; // the attempt this request is for (>= 1)
  session_id: string | null;
}

export type ProjectionResult =
  | { ok: true; request: ExecutionRequest; excluded: { kind: string; source?: string }[] }
  | { ok: false; error: "capability_mismatch" | "missing_context" | "contradiction"; fields: string[] };

const present = (v: unknown) => v !== undefined && v !== null && v !== "";

export function projectContext(
  policy: ProjectionPolicy,
  item: ProjectableWorkItem,
  approval: Approval | null,
  candidates: ContextItem[] = [], // context LUNA *could* share; the policy decides
): ProjectionResult {
  if (item.capability !== policy.capability) return { ok: false, error: "capability_mismatch", fields: [item.capability] };

  const missing = policy.requiredInputs.filter((k) => !present(item.args[k]));
  if (policy.outward && !approval) missing.push("approval");
  if (missing.length) return { ok: false, error: "missing_context", fields: missing };

  // Copy only declared inputs; anything else in the args is not forwarded.
  const inputs: Record<string, unknown> = {};
  for (const k of [...policy.requiredInputs, ...policy.optionalInputs]) {
    if (present(item.args[k])) inputs[k] = item.args[k];
  }

  const contradictions = policy.findContradictions?.(inputs) ?? [];
  if (contradictions.length) return { ok: false, error: "contradiction", fields: contradictions };

  const allowed = new Set(policy.allowedContextKinds);
  const context = candidates.filter((c) => allowed.has(c.kind));
  const excluded = candidates.filter((c) => !allowed.has(c.kind)).map((c) => ({ kind: c.kind, source: c.source }));

  return {
    ok: true,
    excluded,
    request: {
      contract_version: EXECUTION_CONTRACT_VERSION,
      request_id: item.id,
      objective: policy.objective,
      inputs,
      context,
      constraints: [...policy.constraints],
      expected_output: { description: policy.expectedOutput },
      permissions: [{ capability: policy.capability, outward: policy.outward }],
      approval,
      operational_state: { attempt: item.attempt, ...(item.session_id ? { session_id: item.session_id } : {}) },
    },
  };
}
