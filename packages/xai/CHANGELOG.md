# @ai-billing/xai

## 0.2.0

### Minor Changes

- 5315582: feat: add AI SDK v7 / LanguageModelMiddlewareV4 support to every package's default entry

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

### Patch Changes

- Updated dependencies [5315582]
  - @ai-billing/core@0.1.6
  - @ai-billing/types@0.0.4

## 0.1.5

### Patch Changes

- Updated dependencies [0fb5389]
  - @ai-billing/types@0.0.3
  - @ai-billing/core@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [2b0c2e2]
  - @ai-billing/types@0.0.2
  - @ai-billing/core@0.1.4

## 0.1.3

### Patch Changes

- faf939a: chore(types): move types to separated package
- Updated dependencies [faf939a]
  - @ai-billing/types@0.0.1
  - @ai-billing/core@0.1.3

## 0.1.2

### Patch Changes

- b1a70f2: docs: update READMEs and getting started docs
- Updated dependencies [b1a70f2]
  - @ai-billing/core@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [c15d515]
  - @ai-billing/core@0.1.1

## 0.1.0

### Minor Changes

- ae29741: fix: remove totalTokens, correct cache-aware billing, expose raw provider cost in usage

### Patch Changes

- d4e7a4c: fix(xai): move token adjustment into a cost function
- Updated dependencies [ae29741]
  - @ai-billing/core@0.1.0

## 0.0.1

### Patch Changes

- 4e823d2: feat(xai): first release
