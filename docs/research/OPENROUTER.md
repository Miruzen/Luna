# OpenRouter — pricing & usage research (2026-10-13)

Supports ADR-016. Prices change, so re-check before relying on them.
Sources: openrouter.ai/docs/faq, /docs/api-reference/limits, /docs/guides/routing/model-fallbacks, /docs/guides/features/tool-calling, and the public model list `GET https://openrouter.ai/api/v1/models` (fetched 2026-10-13, 462 models).

## What it is
An API aggregator: one account, one API key and one OpenAI-compatible endpoint (`https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer <key>`) give access to hundreds of models from many providers.

## Pricing (from docs)
- Prepaid USD credits, pay-as-you-go. **No markup on model prices**: provider prices are passed through.
- **Fee when buying credits: 5.5% (min $0.80) by card/Stripe; 5% by crypto.**
- Unused credits may expire 1 year after purchase.
- A **negative** balance blocks all requests, free models included. Per-key spending caps are available.
- Privacy: prompts and completions are **not logged by default** (metadata is). Opting in to logging gives a 1% discount. Providers that log or train are excluded unless the training toggle is enabled. **Not verified:** whether free-model providers use prompts for training.

## Free models (`:free`)
| Credits purchased (lifetime) | Requests/min | Requests/day |
|---|---|---|
| < $10 | 20 | **50** |
| ≥ $10 | 20 | **1,000** |

On 2026-10-13: 19 free models, **16 of them accept `tools`**. Examples: `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `nvidia/nemotron-3.5-lightning:free`, `openrouter/free`. Their quality for LUNA's date/intent extraction is **untested**.

## Relevant paid models (USD per 1M tokens, input / output; all accept `tools`)
| Model ID | Input | Output | Context |
|---|---|---|---|
| `deepseek/deepseek-v4-flash` | 0.091 | 0.182 | 1M |
| `deepseek/deepseek-v4.1-flash` | 0.044 | 0.630 | 1M |
| `deepseek/deepseek-v4-pro` | 0.436 | 0.872 | 1M |
| `openai/gpt-5-mini` (reference) | 0.25 | 2.00 | — |
| `google/gemini-2.5-flash` (reference) | 0.30 | 2.50 | — |
| `anthropic/claude-haiku-4.5` (reference) | 1.00 | 5.00 | — |

**LUNA estimate** (one intent request ≈ 1,000 input + 150 output tokens): `deepseek/deepseek-v4-flash` ≈ **$0.00012 per request**, so roughly 8,000 requests per $1 before the purchase fee. This is a calculation, not a measurement. Responses include `usage.cost`, so real cost can be measured.

## Usage features relevant to LUNA
- **Tool calling:** OpenAI-compatible `tools` / `tool_choice`. `tools` must be sent on every request.
- **Model fallbacks (inside OpenRouter):** add `"models": ["primary", "fallback", ...]` to the request body. *Any* error (rate limit, downtime, context length, moderation) can trigger the next model. The request is billed at the model actually used, which the response `model` field reports.
- OpenRouter-level fallbacks do **not** help when OpenRouter itself is down. That is why LUNA also needs its own provider fallback (ADR-016).

## Open points to verify during implementation
1. How DeepSeek "thinking" is controlled through OpenRouter, and whether the `reasoning_content` round-trip requirement applies there too (DeepSeek direct requires it with tools; see `_shared/llm/factory.ts`).
2. Quality of a free model vs `deepseek-v4-flash` on Indonesian date/time extraction.
3. Free-model data/training policy.
