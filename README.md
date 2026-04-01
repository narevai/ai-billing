# ai-billing

[![codecov](https://codecov.io/github/narevai/ai-billing/graph/badge.svg?token=KZG0YE4THI)](https://codecov.io/github/narevai/ai-billing)
![Node Current](https://img.shields.io/node/v/%40ai-billing%2Fcore)
![NPM License](https://img.shields.io/npm/l/%40ai-billing%2Fcore)
![Discord](https://img.shields.io/discord/1475412276315033663)

![AI Billing Header 1](/assets/header-1.png)

Middleware for the [Vercel AI SDK](https://sdk.vercel.ai/docs) to send usage events directly to billing platforms (Stripe, Polar, and Lago).

## Installation

```bash
npm install @ai-billing/core @ai-billing/openrouter # Example for OpenRouter
```

## Basic Usage

Wrap your model provider with the billing middleware and define your destinations.

```typescript
import { streamText, wrapLanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';

const billingMiddleware = createOpenRouterV3Middleware({
  destinations: [],
});

const model = wrapLanguageModel({
  model: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })('google/gemini-2.0-flash-001'),
  middleware: billingMiddleware,
});
```

![AI Billing Header 2](/assets/header-2.png)

## Send usage to Polar.sh

Wrap your model provider with the billing middleware and define your destinations.

```typescript
import { streamText, wrapLanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { createPolarDestination } from '@ai-billing/polar';

const billingMiddleware = createOpenRouterV3Middleware({
  destinations: [
    createPolarDestination({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      meterName: 'ai_meter_microdollars',
    })
  ],
});

const model = wrapLanguageModel({
  model: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })('google/gemini-2.0-flash-001'),
  middleware: billingMiddleware,
});

const { textStream } = await streamText({
  model,
  messages: [{ role: 'user', content: 'Quantify the value of metadata.' }],
  providerOptions: { 
    'ai-billing-tags': { userId: 'usr_123', org: 'Acme' } 
  },
});
```

## Status and Roadmap

### Supported Providers

> **Note:** We are prioritizing support for **TEXT models**.

| Provider | Package | Size |
| :--- | :--- | :--- |
| **OpenRouter** | [`@ai-billing/openrouter`](https://www.npmjs.com/package/@ai-billing/openrouter) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fopenrouter) |
| **OpenAI** | [`@ai-billing/openai`](https://www.npmjs.com/package/@ai-billing/openai) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fopenai) |

**Active Development**

Targeted for immediate release.

  * [OpenAI Compatible Providers](https://ai-sdk.dev/providers/openai-compatible-providers#openai-compatible-providers) ![GitHub issue/pull request detail](https://img.shields.io/github/issues/detail/state/narevai/ai-billing/45)
  * [Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) ![GitHub issue/pull request detail](https://img.shields.io/github/issues/detail/state/narevai/ai-billing/46)
  * [Google Generative AI](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai) ![GitHub issue/pull request detail](https://img.shields.io/github/issues/detail/state/narevai/ai-billing/47)
  * [Vercel AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway) ![GitHub issue/pull request detail](https://img.shields.io/github/issues/detail/state/narevai/ai-billing/48)

### Supported Destinations

| Provider | Package | Size |
| :--- | :--- | :--- |
| **Polar.sh** | [`@ai-billing/polar`](https://www.npmjs.com/package/@ai-billing/polar) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fpolar) |


**Active development**
- **Lago** ![GitHub issue/pull request detail](https://img.shields.io/github/issues/detail/state/narevai/ai-billing/49)
- **OpenMeter/Kong** ![GitHub issue/pull request detail](https://img.shields.io/github/issues/detail/state/narevai/ai-billing/50)
- **Stripe** ![GitHub issue/pull request detail](https://img.shields.io/github/issues/detail/state/narevai/ai-billing/51)

### Backlog

Full list of providers can be found here: https://ai-sdk.dev/providers/
The following providers are planned for future implementation. **To prioritize a specific provider, please [open a GitHub issue](https://github.com/narevai/ai-billing/issues).**

## Architecture

The package consists of two primary components:

### 1. Provider Middleware
Specialized wrappers for `@ai-sdk/provider` that understand the specific `providerMetadata` shapes of different LLM hosts. This ensures accurate cost extraction (e.g., capturing OpenRouter's specific `usage.cost` field rather than estimating based on token counts).

### 2. Destinations
Functions that receive a normalized `BillingEvent` and handle the API calls to external services.
* **Stripe**: Report usage to metered billing prices.
* **Polar.sh**: Send usage events for subscription benefits.
* **Lago / Orb**: Report events for complex usage-based billing schemas.
* **Console**: Local debugging and logging.

## Metadata and Tagging

Pass custom attributes (e.g., `customerId`, `organizationId`) via headers to associate usage with specific entities. The middleware automatically parses the `x-ai-billing-tags` header.

```typescript
const result = await generateText({
  model: wrappedModel,
  headers: {
    'x-ai-billing-tags': JSON.stringify({ customerId: 'cust_12345' }),
  },
  messages: [...],
});
```


## Custom Provider Implementation

To support a custom or internal provider, use the `createV3BillingMiddleware` factory:

```typescript
import { createV3BillingMiddleware } from '@ai-billing/core';

export function createCustomMiddleware(options) {
  return createV3BillingMiddleware({
    ...options,
    buildEvent: ({ model, usage, providerMetadata, responseId, tags }) => {
      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        usage: {
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
        },
        cost: {
          amount: calculateInternalCost(usage), // Your logic
          currency: 'USD',
        },
        tags,
      };
    },
  });
}
```