// How the Jarvis adapter talks to a running Jarvis. Everything Jarvis-shaped lives in
// this folder and nowhere else in LUNA.
//
// JarvisRunOutput mirrors OpenJarvis' agent-mode result from `Jarvis.ask_full()`
// (OpenJarvis @ c14f579, src/openjarvis/sdk.py:585-599).
//
// Stage 1 ships no network transport on purpose: where Jarvis runs (D-01) is deferred,
// and the HTTP shape of Jarvis' agent endpoints has not been verified. Tests use a mock.

export interface JarvisRunInput {
  query: string; // Jarvis entry points take free text (recon F5)
  tools: string[]; // allow-list of Jarvis tool names for this run
  metadata: { request_id: string; attempt: number; session_id?: string };
}

export interface JarvisToolResult {
  tool_name: string;
  content: string;
  success: boolean;
}

export interface JarvisRunOutput {
  content: string;
  tool_results: JarvisToolResult[];
  turns?: number;
  model?: string;
  engine?: string;
}

export interface JarvisTransport {
  run(input: JarvisRunInput): Promise<JarvisRunOutput>;
}
