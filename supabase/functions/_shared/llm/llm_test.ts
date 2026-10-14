import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from "jsr:@std/assert@1";
import { buildProvider } from "./factory.ts";
import { FallbackProvider } from "./fallback.ts";
import type { IntentInput, LLMProvider, ProviderResult } from "./provider.ts";

const input: IntentInput = {
  userText: "besok jam 3 sore meeting sama tim",
  nowLocal: "2026-10-14T10:00:00+07:00 (Wednesday)",
  timezone: "Asia/Jakarta",
  history: [],
};

const envOf = (vars: Record<string, string>) => (key: string) => vars[key];

const fullEnv = {
  LLM_PROVIDERS: "openrouter,deepseek",
  OPENROUTER_API_KEY: "or-key",
  OPENROUTER_MODELS: "google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free",
  DEEPSEEK_API_KEY: "ds-key",
  LLM_MODEL: "deepseek-flash",
};

// Records requests and replies with a canned chat-completions response.
function fakeFetch(status = 200, body: unknown = { choices: [{ message: { content: "Jam berapa?" } }] }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as unknown as typeof fetch;
  return { fn, calls };
}

class StubProvider implements LLMProvider {
  calls = 0;
  constructor(readonly name: string, private outcome: ProviderResult | Error) {}
  extractCalendarIntent() {
    this.calls++;
    return this.outcome instanceof Error ? Promise.reject(this.outcome) : Promise.resolve(this.outcome);
  }
}

// --- factory -------------------------------------------------------------

Deno.test("factory: builds the ordered chain openrouter > deepseek", () => {
  assertEquals(buildProvider(envOf(fullEnv)).name, "openrouter>deepseek");
});

Deno.test("factory: provider without a key is skipped, not fatal", () => {
  const { OPENROUTER_API_KEY: _, ...env } = fullEnv;
  assertEquals(buildProvider(envOf(env)).name, "deepseek");
});

Deno.test("factory: legacy single LLM_PROVIDER still works", () => {
  assertEquals(buildProvider(envOf({ LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k", LLM_MODEL: "m" })).name, "deepseek");
});

Deno.test("factory: nothing configured throws a clear error", () => {
  assertThrows(() => buildProvider(envOf({ LLM_PROVIDERS: "openrouter" })), Error, "No LLM provider configured");
});

Deno.test("factory: unknown provider name throws", () => {
  assertThrows(() => buildProvider(envOf({ LLM_PROVIDERS: "nope" })), Error, "Unknown LLM provider");
});

// --- fallback ------------------------------------------------------------

Deno.test("fallback: first provider fails, second answers", async () => {
  const a = new StubProvider("openrouter", new Error("503 down"));
  const b = new StubProvider("deepseek", { kind: "text", text: "ok" });
  const res = await new FallbackProvider([a, b]).extractCalendarIntent(input);
  assertEquals(res, { kind: "text", text: "ok" });
  assertEquals([a.calls, b.calls], [1, 1]);
});

Deno.test("fallback: first provider answers, second is never called", async () => {
  const a = new StubProvider("openrouter", { kind: "text", text: "ok" });
  const b = new StubProvider("deepseek", { kind: "text", text: "unused" });
  await new FallbackProvider([a, b]).extractCalendarIntent(input);
  assertEquals(b.calls, 0);
});

Deno.test("fallback: all fail -> one error naming every provider", async () => {
  const p = new FallbackProvider([
    new StubProvider("openrouter", new Error("503 down")),
    new StubProvider("deepseek", new Error("402 insufficient balance")),
  ]);
  const err = await assertRejects(() => p.extractCalendarIntent(input));
  assertStringIncludes(String(err), "openrouter: 503 down");
  assertStringIncludes(String(err), "deepseek: 402 insufficient balance");
});

// --- request shape -------------------------------------------------------

Deno.test("openrouter: request carries model, OpenRouter fallback models, tools and auth", async () => {
  const f = fakeFetch();
  const env = { ...fullEnv, LLM_PROVIDERS: "openrouter" };
  const res = await buildProvider(envOf(env), f.fn).extractCalendarIntent(input);

  assertEquals(res, { kind: "text", text: "Jam berapa?" });
  assertEquals(f.calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
  assertEquals((f.calls[0].init.headers as Record<string, string>).Authorization, "Bearer or-key");
  const body = JSON.parse(f.calls[0].init.body as string);
  assertEquals(body.model, "google/gemma-4-31b-it:free");
  assertEquals(body.models, ["google/gemma-4-31b-it:free", "nvidia/nemotron-3-super-120b-a12b:free"]);
  assertEquals(body.tools[0].function.name, "create_google_calendar_event");
});

Deno.test("deepseek: request keeps thinking disabled", async () => {
  const f = fakeFetch();
  await buildProvider(envOf({ ...fullEnv, LLM_PROVIDERS: "deepseek" }), f.fn).extractCalendarIntent(input);
  const body = JSON.parse(f.calls[0].init.body as string);
  assertEquals(f.calls[0].url, "https://api.deepseek.com/chat/completions");
  assertEquals(body.thinking, { type: "disabled" });
  assertEquals(body.models, undefined);
});

Deno.test("provider: HTTP error throws with provider name and status (so fallback can act)", async () => {
  const f = fakeFetch(429, { error: "rate limited" });
  const p = buildProvider(envOf({ ...fullEnv, LLM_PROVIDERS: "openrouter" }), f.fn);
  const err = await assertRejects(() => p.extractCalendarIntent(input));
  assertStringIncludes(String(err), "openrouter error 429");
});

Deno.test("provider: tool call is parsed into structured args", async () => {
  const args = { title: "Meeting tim", start_datetime: "2026-10-15T15:00:00+07:00" };
  const f = fakeFetch(200, {
    choices: [{ message: { tool_calls: [{ function: { name: "create_google_calendar_event", arguments: JSON.stringify(args) } }] } }],
  });
  const res = await buildProvider(envOf({ ...fullEnv, LLM_PROVIDERS: "openrouter" }), f.fn).extractCalendarIntent(input);
  assertEquals(res, { kind: "tool_call", args });
});
