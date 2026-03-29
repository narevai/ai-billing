[![codecov](https://codecov.io/github/narevai/ai-billing/graph/badge.svg?token=KZG0YE4THI)](https://codecov.io/github/narevai/ai-billing)

# ai-billing

Middleware for the [Vercel AI SDK](https://sdk.vercel.ai/docs) to send usage events directly to billing platforms (Stripe, Polar, and Lago).

`ai-billing` intercepts execution results from `generateText` and `streamText` using the Vercel AI SDK middleware. It extracts provider-specific metadata (including exact costs where available) and forwards normalized events to one or more **Destinations**.

## Installation

```bash
npm install @ai-billing/core @ai-billing/openrouter # Example for OpenRouter
```

## Basic Usage

Wrap your model provider with the billing middleware and define your destinations.

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { wrapLanguageModel, streamText } from 'ai';
import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { stripeDestination } from '@ai-billing/stripe';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const billingMiddleware = createOpenRouterV3Middleware({
  destinations: [
    stripeDestination({ apiKey: process.env.STRIPE_SECRET_KEY })
  ],
  // Optional: prevent blocking the response while sending billing data
  waitUntil: (promise) => promise, 
});

const wrappedModel = wrapLanguageModel({
  model: openrouter('google/gemini-2.0-flash-001'),
  middleware: billingMiddleware,
});

const result = await streamText({
  model: wrappedModel,
  messages: [{ role: 'user', content: 'Quantify the value of metadata.' }],
});
```

## Status and Roadmap

### Supported Destinations

Current stable implementations.

| Provider | Package |
| :--- | :--- |

**Active development**
- **Polar.sh**
- **Stripe**
- **Lago**

### Supported Providers

Current stable implementations.

| Provider | Package |
| :--- | :--- |
| **OpenRouter** | [`@ai-billing/core`](https://www.npmjs.com/package/@ai-billing/openrouter) |

**Active Development**

Targeted for immediate release.

  * [OpenAI Compatible Providers](https://ai-sdk.dev/providers/openai-compatible-providers#openai-compatible-providers)
  * [OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai)
  * [Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
  * [Google Generative AI](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)
  * [Vercel AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)

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