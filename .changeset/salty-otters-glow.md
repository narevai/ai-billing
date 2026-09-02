---
"@ai-billing/core": patch
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
"@ai-billing/types": patch
---

feat: add AI SDK v7 / LanguageModelMiddlewareV4 support to every package's default entry

Every billing middleware package now ships both its `v3/` (`LanguageModelV3Middleware`, AI SDK v6)
and `v4/` (`LanguageModelV4Middleware`, AI SDK v7) implementations from the package's normal `.`
export — there is no separate `./v4` export subpath. Each provider package now exports
`createXV3Middleware`/`XV3MiddlewareOptions` alongside `createXV4Middleware`/`XV4MiddlewareOptions`
(for example `createOpenAIV3Middleware`/`createOpenAIV4Middleware` from `@ai-billing/openai`).
`@ai-billing/core` gains `createV4BillingMiddleware`/`BillingMiddlewareV4Options` alongside the
existing `V3` versions, and `@ai-billing/testing` continues to export `MockLanguageModelV4`
alongside the existing `MockLanguageModelV2`/`MockLanguageModelV3` mocks.

AI SDK v6 (`LanguageModelMiddlewareV3`) and AI SDK v7 (`LanguageModelMiddlewareV4`) are both
supported concurrently: peer dependency ranges were widened (never narrowed) to accept either
major of each provider's upstream AI SDK package.

For every provider package, the previously-unversioned convenience alias — `createXMiddleware` /
`XMiddlewareOptions` (for example `createOpenAIMiddleware`/`OpenAIMiddlewareOptions`) — now points
at the new **V4** factory (AI SDK v7 / `LanguageModelV4Middleware`) by default. Existing V3
behavior is unaffected and remains available under the explicit
`createXV3Middleware`/`XV3MiddlewareOptions` names (for example
`createOpenAIV3Middleware`/`OpenAIV3MiddlewareOptions` from `@ai-billing/openai`) for anyone who
wants to pin to it. Because `LanguageModelV3Middleware` and `LanguageModelV4Middleware` are
structurally compatible, existing applications keep working unmodified, no dependency bump is
forced on consumers, and no runtime behavior changes for V3 users — this is an additive feature,
not a breaking change.
