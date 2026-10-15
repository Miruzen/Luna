// Jarvis adapter (Stage 1 skeleton). Translates LUNA's structured ExecutionRequest into a
// Jarvis run and maps Jarvis' output back into an ExecutionResult. LUNA only sees the
// ExecutionEngine interface; swapping Jarvis means replacing this folder.
import {
  type ActionRecord,
  EXECUTION_CONTRACT_VERSION,
  type ExecutionError,
  type ExecutionRequest,
  type ExecutionResult,
  type Evidence,
} from "../contract.ts";
import type { ExecutionEngine } from "../interface.ts";
import type { JarvisRunOutput, JarvisTransport } from "./transport.ts";

// Jarvis' ToolExecutor refuses confirmation-gated tools when no interactive callback exists
// (OpenJarvis @ c14f579, src/openjarvis/tools/_stubs.py:400-410).
const JARVIS_CONFIRMATION_REFUSAL = "requires confirmation but no confirmation callback is available";
// Jarvis gives up after max_turns with this fixed text; ask_full() drops the max_turns_exceeded flag
// (OpenJarvis @ c14f579, src/openjarvis/agents/_stubs.py:313-330, sdk.py:585-599). Stage 2 F3.
const JARVIS_MAX_TURNS = "Maximum turns reached without a final answer.";
const EVIDENCE_MAX_CHARS = 500;

export interface JarvisAdapterConfig {
  transport: JarvisTransport;
  // LUNA capability -> Jarvis tool names. A capability with no mapping is not supported.
  capabilityTools: Record<string, string[]>;
}

export class JarvisAdapter implements ExecutionEngine {
  readonly id = "jarvis";

  constructor(private cfg: JarvisAdapterConfig) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const unsupported = request.permissions.filter((p) => !this.cfg.capabilityTools[p.capability]?.length);
    if (unsupported.length) {
      return this.result(request, "rejected", null, [], [], [{
        code: "capability_not_supported",
        message: `Jarvis has no tool for: ${unsupported.map((p) => p.capability).join(", ")}`,
        retryable: false,
      }], "Route this capability to another engine or add it to Jarvis.");
    }

    const allowed = [...new Set(request.permissions.flatMap((p) => this.cfg.capabilityTools[p.capability]))];
    const output = await this.cfg.transport.run({
      query: buildQuery(request),
      tools: allowed,
      metadata: {
        request_id: request.request_id,
        attempt: request.operational_state.attempt,
        session_id: request.operational_state.session_id,
      },
    });
    return this.mapOutput(request, output, allowed);
  }

  private mapOutput(request: ExecutionRequest, output: JarvisRunOutput, allowed: string[]): ExecutionResult {
    const toolResults = Array.isArray(output?.tool_results) ? output.tool_results : [];
    const actions: ActionRecord[] = toolResults.map((t) => ({
      action: t.tool_name,
      outcome: t.success ? "succeeded" : "failed",
      detail: truncate(t.content),
    }));
    const evidence: Evidence[] = [
      ...toolResults.map((t) => ({ kind: "tool_output", description: truncate(t.content), ref: t.tool_name })),
      ...(output?.content ? [{ kind: "engine_response", description: truncate(output.content) }] : []),
    ];

    // Defense in depth: Jarvis must stay inside the permissions LUNA granted.
    const outside = toolResults.filter((t) => !allowed.includes(t.tool_name));
    if (outside.length) {
      return this.result(request, "failed", null, evidence, actions, [{
        code: "permission_violation",
        message: `Jarvis used tools outside the granted permissions: ${outside.map((t) => t.tool_name).join(", ")}`,
        retryable: false,
      }], "Investigate the Jarvis configuration before retrying.");
    }

    // LUNA's approval is the authorization (ADR-013). If a Jarvis tool still asks for its
    // own confirmation, escalate instead of approving on Jarvis' behalf.
    const gated = toolResults.filter((t) => !t.success && t.content.includes(JARVIS_CONFIRMATION_REFUSAL));
    if (gated.length) {
      return this.result(request, "needs_approval", null, evidence, actions, [{
        code: "engine_requested_approval",
        message: `Jarvis tool(s) require their own confirmation: ${gated.map((t) => t.tool_name).join(", ")}`,
        retryable: false,
      }], "Per ADR-013 the Jarvis tool should not require its own confirmation when LUNA has approved.");
    }

    const failed = toolResults.filter((t) => !t.success);
    if (failed.length) {
      return this.result(request, "failed", null, evidence, actions, failed.map((t) => ({
        code: "tool_failed",
        message: `${t.tool_name}: ${truncate(t.content)}`,
        retryable: false, // outward actions are not blindly retried
      })), null);
    }

    // An unfinished run must never be reported as done (Stage 2, F3).
    if ((output?.content ?? "").trim() === JARVIS_MAX_TURNS) {
      return this.result(request, "failed", null, evidence, actions, [{
        code: "engine_incomplete",
        message: "Jarvis stopped at its turn limit without finishing the task.",
        retryable: true,
      }], "Retry, or simplify the task.");
    }

    return this.result(request, "completed", output?.content ?? "", evidence, actions, [], null);
  }

  private result(
    request: ExecutionRequest,
    status: ExecutionResult["status"],
    result: string | null,
    evidence: Evidence[],
    actions: ActionRecord[],
    errors: ExecutionError[],
    next: string | null,
  ): ExecutionResult {
    return {
      contract_version: EXECUTION_CONTRACT_VERSION,
      request_id: request.request_id,
      engine: this.id,
      status,
      result,
      evidence,
      actions_taken: actions,
      artifacts: [],
      errors,
      next_recommendation: next,
    };
  }
}

// Only the explicitly projected context goes to Jarvis (ADR-008).
export function buildQuery(request: ExecutionRequest): string {
  const lines = [`Objective: ${request.objective}`];
  if (request.inputs && Object.keys(request.inputs).length) {
    // Already approved by Nanda: passed as data, not prose, so nothing gets re-interpreted.
    lines.push("Inputs (use exactly these values):", JSON.stringify(request.inputs, null, 2));
  }
  if (request.context.length) {
    lines.push("Context:", ...request.context.map((c) => `- [${c.kind}] ${c.content}`));
  }
  if (request.constraints.length) {
    lines.push("Constraints:", ...request.constraints.map((c) => `- ${c}`));
  }
  lines.push(`Expected output: ${request.expected_output.description}`);
  if (request.approval) {
    lines.push("This action was approved by the user. Do not ask for confirmation.");
  }
  return lines.join("\n");
}

function truncate(s: string): string {
  return s.length > EVIDENCE_MAX_CHARS ? `${s.slice(0, EVIDENCE_MAX_CHARS)}…` : s;
}
