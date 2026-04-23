# ai-billing

Middleware for the [Vercel AI SDK](https://sdk.vercel.ai/docs) seing events directly to billing platforms (Stripe, Polar, and Lago).

[![codecov](https://codecov.io/github/narevai/ai-billing/graph/badge.svg?token=KZG0YE4THI)](https://codecov.io/github/narevai/ai-billing)
![Node Current](https://img.shields.io/node/v/%40ai-billing%2Fcore)
![NPM License](https://img.shields.io/npm/l/%40ai-billing%2Fcore)
<a href="https://discord.gg/eAFaCwmEEy">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
</a>

<p align="center">
  <img src="/assets/header-1.png" alt="AI Billing Header 1">
</p>

### Supported Providers

| Provider | Package | Size |
| :--- | :--- | :--- |
| [**OpenRouter**](https://ai-sdk.dev/providers/community-providers/openrouter) | [`@ai-billing/openrouter`](https://www.npmjs.com/package/@ai-billing/openrouter) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fopenrouter) |
| [**OpenAI**](https://ai-sdk.dev/providers/ai-sdk-providers/openai) | [`@ai-billing/openai`](https://www.npmjs.com/package/@ai-billing/openai) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fopenai) |
| [**Vercel AI Gateway**](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway) | [`@ai-billing/gateway`](https://www.npmjs.com/package/@ai-billing/gateway) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fgateway) |
| [**OpenAI Compatible**](https://ai-sdk.dev/providers/openai-compatible-providers) | [`@ai-billing/openai-compatible`](https://www.npmjs.com/package/@ai-billing/openai-compatible) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fopenai-compatible) |
| [**Groq**](https://ai-sdk.dev/providers/ai-sdk-providers/groq) | [`@ai-billing/groq`](https://www.npmjs.com/package/@ai-billing/groq) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fgroq) |
| [**Google Generative AI**](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai) | [`@ai-billing/google`](https://www.npmjs.com/package/@ai-billing/google) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fgoogle) |
| [**Anthropic**](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) | [`@ai-billing/anthropic`](https://www.npmjs.com/package/@ai-billing/anthropic) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fanthropic) |
| [**xAI Grok**](https://ai-sdk.dev/providers/ai-sdk-providers/xai) | [`@ai-billing/xai`](https://www.npmjs.com/package/@ai-billing/xai) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fxai) |
| [**MiniMax**](https://ai-sdk.dev/providers/community-providers/minimax) | [`@ai-billing/minimax`](https://www.npmjs.com/package/@ai-billing/minimax) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fminimax) |

### Supported Destinations

| Destination | Package | Size |
| :--- | :--- | :--- |
| **Polar.sh** | [`@ai-billing/polar`](https://www.npmjs.com/package/@ai-billing/polar) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fpolar) |
| **Stripe** | [`@ai-billing/stripe`](https://www.npmjs.com/package/@ai-billing/stripe) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fstripe) |
| **OpenMeter** (Kong) | [`@ai-billing/openmeter`](https://www.npmjs.com/package/@ai-billing/openmeter) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fopenmeter) |
| **Lago** | [`@ai-billing/lago`](https://www.npmjs.com/package/@ai-billing/lago) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Flago) |

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

<p align="center">
  <img src="/assets/header-2.png" alt="AI Billing Header 2">
</p>

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
* [Requesty](https://ai-sdk.dev/providers/community-providers/requesty)
* [Cloudflare AI Gateway](https://ai-sdk.dev/providers/community-providers/cloudflare-ai-gateway)

Full list of providers can be found here: https://ai-sdk.dev/providers/
The following providers are planned for future implementation. **To prioritize a specific provider, please [open a GitHub issue](https://github.com/narevai/ai-billing/issues).**

## Architecture

The package consists of two primary components:

### 1. Provider Middleware
- specialized for `@ai-sdk/*` that understand the specific `providerMetadata` shapes of different LLM usage
- provider-specific cost calculation logic that that turn usage into cost
- `PriceResolver` allowing to pass custom prices at time of request

### 2. Destinations
- functions that receive a normalized `BillingEvent` and handle the API calls to external services
- allow charging in credits using standardized meters