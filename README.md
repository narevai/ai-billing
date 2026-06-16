

# [ai-billing](https://github.com/narevai/ai-billing)





Middleware for the [Vercel AI SDK](https://sdk.vercel.ai/docs) that sends billing events directly to Stripe, Polar, and Lago. Ships with components to make usage-based billing easy.

## Full-stack examples


| Name                             | Demo Link                                                          | Repo                                                                   | Deploy                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chatbot (OpenRouter + Polar)** | [View Demo](https://chatbot-with-billing-polar-three.vercel.app/)  | [GitHub](https://github.com/narevai/chatbot-with-billing-polar)        | [Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fai-billing%2Ftree%2Fmain%2Fexamples%2Fchatbot-with-billing-polar)                                                                                                                 |
| **Chatbot (OpenAI + Polar)**     | [View Demo](https://chatbot-openai-with-billing-polar.vercel.app/) | [GitHub](https://github.com/narevai/chatbot-openai-with-billing-polar) | [Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-openai-with-billing-polar&env=AUTH_SECRET,OPENAI_API_KEY,POSTGRES_URL,POLAR_ACCESS_TOKEN,POLAR_SERVER,NAREV_API_KEY&envDefaults=%7B%22POLAR_SERVER%22%3A%22sandbox%22%7D) |
| **Chatbot (Stripe)**             | [View Demo](https://chatbot-with-billing-stripe.vercel.app/)       | [GitHub](https://github.com/narevai/chatbot-with-billing-stripe)       | [Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-with-billing-polar&env=AUTH_SECRET,AI_GATEWAY_API_KEY,POSTGRES_URL,POLAR_ACCESS_TOKEN,POLAR_SERVER&envDefaults=%7B%22POLAR_SERVER%22%3A%22sandbox%22%7D)                  |


## Billing Architecture



### Supported Providers


| Provider                                                                                       | Package                                                                                        | Size              |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------- |
| **[OpenRouter](https://ai-sdk.dev/providers/community-providers/openrouter)**                  | `[@ai-billing/openrouter](https://www.npmjs.com/package/@ai-billing/openrouter)`               | NPM Unpacked Size |
| **[OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai)**                             | `[@ai-billing/openai](https://www.npmjs.com/package/@ai-billing/openai)`                       | NPM Unpacked Size |
| **[Vercel AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)**              | `[@ai-billing/gateway](https://www.npmjs.com/package/@ai-billing/gateway)`                     | NPM Unpacked Size |
| **[OpenAI Compatible](https://ai-sdk.dev/providers/openai-compatible-providers)**              | `[@ai-billing/openai-compatible](https://www.npmjs.com/package/@ai-billing/openai-compatible)` | NPM Unpacked Size |
| **[Groq](https://ai-sdk.dev/providers/ai-sdk-providers/groq)**                                 | `[@ai-billing/groq](https://www.npmjs.com/package/@ai-billing/groq)`                           | NPM Unpacked Size |
| **[Google Generative AI](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)** | `[@ai-billing/google](https://www.npmjs.com/package/@ai-billing/google)`                       | NPM Unpacked Size |
| **[Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)**                       | `[@ai-billing/anthropic](https://www.npmjs.com/package/@ai-billing/anthropic)`                 | NPM Unpacked Size |
| **[xAI Grok](https://ai-sdk.dev/providers/ai-sdk-providers/xai)**                              | `[@ai-billing/xai](https://www.npmjs.com/package/@ai-billing/xai)`                             | NPM Unpacked Size |
| **[MiniMax](https://ai-sdk.dev/providers/community-providers/minimax)**                        | `[@ai-billing/minimax](https://www.npmjs.com/package/@ai-billing/minimax)`                     | NPM Unpacked Size |
| **[DeepSeek](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek)**                         | `[@ai-billing/deepseek](https://www.npmjs.com/package/@ai-billing/deepseek)`                   | NPM Unpacked Size |
| **[Chutes](https://ai-sdk.dev/providers/community-providers/chutes)**                          | `[@ai-billing/chutes](https://www.npmjs.com/package/@ai-billing/chutes)`                       | NPM Unpacked Size |


### Supported Destinations


| Destination          | Package                                                                        | Size              |
| -------------------- | ------------------------------------------------------------------------------ | ----------------- |
| **Polar.sh**         | `[@ai-billing/polar](https://www.npmjs.com/package/@ai-billing/polar)`         | NPM Unpacked Size |
| **Stripe**           | `[@ai-billing/stripe](https://www.npmjs.com/package/@ai-billing/stripe)`       | NPM Unpacked Size |
| **OpenMeter** (Kong) | `[@ai-billing/openmeter](https://www.npmjs.com/package/@ai-billing/openmeter)` | NPM Unpacked Size |
| **Lago**             | `[@ai-billing/lago](https://www.npmjs.com/package/@ai-billing/lago)`           | NPM Unpacked Size |


## UI Components

Explore the full component library in [Storybook](https://ai-billing-storybook.vercel.app/).


| Component            | Preview |
| -------------------- | ------- |
| `<CreditTopUpPolar>` |         |
| `<CreditUsagePolar>` |         |


### SDKs


| Package                                                                  | Description                                                              | Size              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------- |
| `[@ai-billing/nextjs](https://www.npmjs.com/package/@ai-billing/nextjs)` | Next.js UI components for displaying billing usage and managing top-ups. | NPM Unpacked Size |
| `[@ai-billing/ui](https://www.npmjs.com/package/@ai-billing/ui)`         | Internal headless UI components shared across `@ai-billing/`* packages.  | NPM Unpacked Size |
| `[@ai-billing/narev](https://www.npmjs.com/package/@ai-billing/narev)`   | TypeScript SDK for the [Narev](https://narev.ai) billing API.            | NPM Unpacked Size |


---

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

const billingMiddleware = createOpenRouterV3Middleware({});

const model = wrapLanguageModel({
  model: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })('google/gemini-2.0-flash-001'),
  middleware: billingMiddleware,
});
```

---

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
      eventName: 'llm_usage',
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

> **Note:** We are prioritizing support for **TEXT models**.

**Active Development**

- [Requesty](https://ai-sdk.dev/providers/community-providers/requesty)
- [Cloudflare AI Gateway](https://ai-sdk.dev/providers/community-providers/cloudflare-ai-gateway)

Full list of providers can be found here: [https://ai-sdk.dev/providers/](https://ai-sdk.dev/providers/)
The following providers are planned for future implementation. **To prioritize a specific provider, please [open a GitHub issue](https://github.com/narevai/ai-billing/issues).**

## Architecture

The package consists of two primary components:

### 1. Provider Middleware

- specialized for `@ai-sdk/`* that understand the specific `providerMetadata` shapes of different LLM usage
- provider-specific cost calculation logic that that turn usage into cost
- `PriceResolver` allowing to pass custom prices at time of request

### 2. Destinations

- functions that receive a normalized `BillingEvent` and handle the API calls to external services
- allow charging in credits using standardized meters

