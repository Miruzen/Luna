// Latency/correctness benchmark for intent extraction, one provider+model at a time
// (no fallback chain, so each number belongs to exactly one model).
//
//   deno run --env-file=.env --allow-env --allow-net scripts/bench_llm.ts [runs] [extra openrouter models...]
//
// Default targets: every model in OPENROUTER_MODELS, plus DeepSeek direct (LLM_MODEL).
// Extra args are OpenRouter model ids, e.g. "deepseek/deepseek-chat-v3.1".
import { OpenAICompatibleProvider } from "../_shared/llm/openai_compatible.ts";
import type { LLMProvider } from "../_shared/llm/provider.ts";
import { validateEventArgs } from "../_shared/calendar/validate.ts";
import { localNow } from "../_shared/time.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const runs = Number(Deno.args[0] ?? 3);
const extraModels = Deno.args.slice(1);
const tz = env("DEFAULT_TIMEZONE") || "Asia/Jakarta";

const targets: LLMProvider[] = [];
if (env("OPENROUTER_API_KEY")) {
  const models = [...env("OPENROUTER_MODELS").split(","), ...extraModels].map((s) => s.trim()).filter(Boolean);
  for (const model of models) {
    targets.push(new OpenAICompatibleProvider({
      name: `openrouter:${model}`, baseUrl: "https://openrouter.ai/api/v1", apiKey: env("OPENROUTER_API_KEY"), model,
    }));
  }
}
if (env("DEEPSEEK_API_KEY") && env("LLM_MODEL")) {
  targets.push(new OpenAICompatibleProvider({
    name: `deepseek:${env("LLM_MODEL")}`, baseUrl: "https://api.deepseek.com", apiKey: env("DEEPSEEK_API_KEY"),
    model: env("LLM_MODEL"), extraBody: { thinking: { type: "disabled" } },
  }));
}

// expect: "confirm" = a valid tool call; "clarify" = a text question.
const cases = [
  { text: "besok jam 3 sore meeting sama tim marketing 1 jam", expect: "confirm" },
  { text: "jadwalin gym besok", expect: "clarify" },
] as const;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

console.log(`now=${localNow(tz)} runs=${runs}\n`);
for (const p of targets) {
  const times: number[] = [];
  let correct = 0, errors = 0;
  for (const c of cases) {
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      try {
        const r = await p.extractCalendarIntent({ userText: c.text, nowLocal: localNow(tz), timezone: tz, history: [] });
        times.push(performance.now() - t0);
        const got = r.kind === "tool_call" ? (validateEventArgs(r.args).ok ? "confirm" : "invalid") : "clarify";
        if (got === c.expect) correct++;
        else console.log(`  [${p.name}] "${c.text}" → ${got}: ${JSON.stringify(r).slice(0, 200)}`);
      } catch (e) {
        errors++;
        console.log(`  [${p.name}] error: ${String(e).slice(0, 200)}`);
      }
    }
  }
  const total = cases.length * runs;
  const latency = times.length
    ? `median ${(median(times) / 1000).toFixed(1)}s · max ${(Math.max(...times) / 1000).toFixed(1)}s`
    : "no successful calls";
  console.log(`${p.name}\n  ${latency} · correct ${correct}/${total} · errors ${errors}\n`);
}
