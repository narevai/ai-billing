# @ai-billing/openrouter

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

- Updated dependencies [ae29741]
  - @ai-billing/core@0.1.0

## 0.0.7

### Patch Changes

- Updated dependencies [6010076]
- Updated dependencies [37b9935]
  - @ai-billing/core@0.0.7

## 0.0.6

### Patch Changes

- Updated dependencies [91da798]
  - @ai-billing/core@0.0.6

## 0.0.5

### Patch Changes

- 645cb17: rename subProviderId to subProvider
- 551224b: chore: add Typedoc and docs:generate for sdk docs
- Updated dependencies [645cb17]
- Updated dependencies [551224b]
- Updated dependencies [df01f60]
  - @ai-billing/core@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [46ea0ba]
  - @ai-billing/core@0.0.4

## 0.0.3

### Patch Changes

- 83f7a7a: fix repository.directory metadata in package.json
- 2d03aa2: add gateway cache tokens and update billing types; refactor: add zod test validation
- Updated dependencies [2d03aa2]
- Updated dependencies [0a5b091]
- Updated dependencies [ab239d8]
  - @ai-billing/core@0.0.3

## 0.0.2

### Patch Changes

- e3db55c: add support for providers that do not return cost
- Updated dependencies [fa5f27c]
- Updated dependencies [e3db55c]
  - @ai-billing/core@0.0.2

## 0.0.1

### Patch Changes

- 090c609: openrouter provider and console destination
- 446e89b: switch to oxlint
- 7d8c0e8: refactor into functional builders
- 00293ed: update repository url links
- ecb6bf2: add edge testing
- 686d635: add readme
- 52e56e7: switch code formatting to oxfmt
- 157730d: add provenance
- dfa0c3f: add ai-billing metadata to the output
- Updated dependencies [96ea45b]
- Updated dependencies [090c609]
- Updated dependencies [9ac7ae6]
- Updated dependencies [490977c]
- Updated dependencies [159b403]
- Updated dependencies [446e89b]
- Updated dependencies [b191a78]
- Updated dependencies [7d8c0e8]
- Updated dependencies [00293ed]
- Updated dependencies [ecb6bf2]
- Updated dependencies [686d635]
- Updated dependencies [52e56e7]
- Updated dependencies [157730d]
- Updated dependencies [dfa0c3f]
  - @ai-billing/core@0.0.1

## 0.0.1-alpha.4

### Patch Changes

- dfa0c3f: add ai-billing metadata to the output
- Updated dependencies [dfa0c3f]
  - @ai-billing/core@0.0.1-alpha.8

## 0.0.1-alpha.3

### Patch Changes

- 00293ed: update repository url links
- Updated dependencies [159b403]
- Updated dependencies [00293ed]
  - @ai-billing/core@0.0.1-alpha.7

## 0.0.1-alpha.2

### Patch Changes

- 157730d: add provenance
- Updated dependencies [157730d]
  - @ai-billing/core@0.0.1-alpha.6

## 0.0.1-alpha.1

### Patch Changes

- 686d635: add readme
- Updated dependencies [686d635]
  - @ai-billing/core@0.0.1-alpha.5

## 0.0.1-alpha.0

### Patch Changes

- 090c609: openrouter provider and console destination
- 446e89b: switch to oxlint
- 7d8c0e8: refactor into functional builders
- ecb6bf2: add edge testing
- 52e56e7: switch code formatting to oxfmt
- Updated dependencies [090c609]
- Updated dependencies [446e89b]
- Updated dependencies [7d8c0e8]
- Updated dependencies [ecb6bf2]
- Updated dependencies [52e56e7]
  - @ai-billing/core@0.0.1-alpha.4
