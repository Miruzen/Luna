// Execution Interface (Stage 1). LUNA delegates only through `delegate()` and an
// `ExecutionEngine`; it never imports an engine's internals. Engines (e.g. the Jarvis
// adapter) implement `ExecutionEngine` and are chosen by whoever wires LUNA together.
import {
  EXECUTION_CONTRACT_VERSION,
  type ExecutionError,
  type ExecutionRequest,
  type ExecutionResult,
  validateExecutionRequest,
  validateExecutionResult,
} from "./contract.ts";

export interface ExecutionEngine {
  readonly id: string;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

function boundaryResult(
  request: ExecutionRequest,
  engine: string,
  status: "failed" | "rejected",
  error: ExecutionError,
): ExecutionResult {
  return {
    contract_version: EXECUTION_CONTRACT_VERSION,
    request_id: request?.request_id ?? "",
    engine,
    status,
    result: null,
    evidence: [],
    actions_taken: [],
    artifacts: [],
    errors: [error],
    next_recommendation: null,
  };
}

// Never throws: every outcome comes back as an ExecutionResult LUNA can evaluate.
export async function delegate(engine: ExecutionEngine, request: ExecutionRequest): Promise<ExecutionResult> {
  const requestErrors = validateExecutionRequest(request);
  if (requestErrors.length) {
    return boundaryResult(request, engine.id, "rejected", {
      code: "invalid_request",
      message: requestErrors.join("; "),
      retryable: false,
    });
  }

  let result: ExecutionResult;
  try {
    result = await engine.execute(request);
  } catch (e) {
    return boundaryResult(request, engine.id, "failed", {
      code: "engine_error",
      message: e instanceof Error ? e.message : String(e),
      retryable: true,
    });
  }

  const resultErrors = validateExecutionResult(result, request);
  if (resultErrors.length) {
    return boundaryResult(request, engine.id, "failed", {
      code: "invalid_engine_result",
      message: resultErrors.join("; "),
      retryable: false,
    });
  }
  return result;
}
