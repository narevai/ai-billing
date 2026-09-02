---
"@ai-billing/core": minor
"@ai-billing/anthropic": minor
"@ai-billing/baseten": minor
"@ai-billing/chutes": minor
"@ai-billing/deepseek": minor
"@ai-billing/gateway": minor
"@ai-billing/google": minor
"@ai-billing/groq": minor
"@ai-billing/minimax": minor
"@ai-billing/openai": minor
"@ai-billing/openai-compatible": minor
"@ai-billing/openrouter": minor
"@ai-billing/xai": minor
"@ai-billing/types": minor
---

feat: add AI SDK v7 / LanguageModelMiddlewareV4 support via a new `./v4` export subpath

Every billing middleware package now ships a `v4/` implementation next to the existing `v3/`
implementation, exposed through a brand-new `./v4` export subpath (for example
`@ai-billing/openai/v4`) backed by its own build entry and `.d.ts` bundle. The existing default
`.` entry point is unchanged: it keeps re-exporting only the `v3/` (`LanguageModelV3Middleware`,
AI SDK v6) implementation, so consumers who don't opt into `./v4` see no change at all.

AI SDK v6 (`LanguageModelMiddlewareV3`) and AI SDK v7 (`LanguageModelMiddlewareV4`) are both
supported concurrently: peer dependency ranges were widened (never narrowed) to accept either
major of each provider's upstream AI SDK package, and `@ai-billing/testing` gained a
`MockLanguageModelV4` alongside the existing `MockLanguageModelV2`/`MockLanguageModelV3` mocks.
