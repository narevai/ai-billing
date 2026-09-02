---
"@ai-billing/core": minor
"@ai-billing/anthropic": major
"@ai-billing/baseten": major
"@ai-billing/chutes": major
"@ai-billing/deepseek": major
"@ai-billing/gateway": major
"@ai-billing/google": major
"@ai-billing/groq": major
"@ai-billing/minimax": major
"@ai-billing/openai": major
"@ai-billing/openai-compatible": major
"@ai-billing/openrouter": major
"@ai-billing/xai": major
"@ai-billing/types": minor
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

## Breaking Changes

For every provider package, the unversioned convenience alias — `createXMiddleware` /
`XMiddlewareOptions` (for example `createOpenAIMiddleware`/`OpenAIMiddlewareOptions`) — now
targets the **V4** factory (AI SDK v7 / `LanguageModelV4Middleware`) instead of V3 (AI SDK v6 /
`LanguageModelV3Middleware`). If you rely on the unversioned alias and need to keep the previous
V3 behavior, import `createXV3Middleware`/`XV3MiddlewareOptions` directly instead (for example
`createOpenAIV3Middleware`/`OpenAIV3MiddlewareOptions` from `@ai-billing/openai`).

`@ai-billing/core` and `@ai-billing/types` are unaffected by this alias repoint and stay on a
minor bump: `core`'s default entry only gains the new `V4` exports alongside the unchanged `V3`
ones.
