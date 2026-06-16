<p align="center">
  <a href="https://github.com/narevai/ai-billing">
    <img src="/assets/header-1.png" alt="ai-billing" width="420">
    <h1 align="center">ai-billing</h1>
  </a>
</p>

<p align="center">
  <a aria-label="Codecov" href="https://codecov.io/github/narevai/ai-billing">
    <img alt="Codecov" src="https://img.shields.io/codecov/c/github/narevai/ai-billing?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="Node version" href="https://www.npmjs.com/package/@ai-billing/core">
    <img alt="Node version" src="https://img.shields.io/node/v/%40ai-billing%2Fcore?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="NPM license" href="https://www.npmjs.com/package/@ai-billing/core">
    <img alt="NPM license" src="https://img.shields.io/npm/l/%40ai-billing%2Fcore?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="Discord chat" href="https://discord.gg/eAFaCwmEEy">
    <img alt="Discord chat" src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg?style=for-the-badge&logo=discord&labelColor=000000">
  </a>
</p>

<p align="center">
  Middleware for the <a href="https://sdk.vercel.ai/docs">Vercel AI SDK</a> that sends billing events directly to Stripe, Polar, and Lago.
  Ships with components to make usage-based billing easy.
</p>


## Full-stack examples
| Name | Demo Link | Repo | Deploy |
| :--- | :--- | :--- | :--- |
| **Chatbot (OpenRouter + Polar)** | [View Demo](https://chatbot-with-billing-polar-three.vercel.app/) | [GitHub](https://github.com/narevai/chatbot-with-billing-polar) | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fai-billing%2Ftree%2Fmain%2Fexamples%2Fchatbot-with-billing-polar) |
| **Chatbot (OpenAI + Polar)** | [View Demo](https://chatbot-openai-with-billing-polar.vercel.app/) | [GitHub](https://github.com/narevai/chatbot-openai-with-billing-polar) | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-openai-with-billing-polar&env=AUTH_SECRET,OPENAI_API_KEY,POSTGRES_URL,POLAR_ACCESS_TOKEN,POLAR_SERVER,NAREV_API_KEY&envDefaults=%7B%22POLAR_SERVER%22%3A%22sandbox%22%7D) |
| **Chatbot (Stripe)** | [View Demo](https://chatbot-with-billing-stripe.vercel.app/) | [GitHub](https://github.com/narevai/chatbot-with-billing-stripe) | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-with-billing-polar&env=AUTH_SECRET,AI_GATEWAY_API_KEY,POSTGRES_URL,POLAR_ACCESS_TOKEN,POLAR_SERVER&envDefaults=%7B%22POLAR_SERVER%22%3A%22sandbox%22%7D) |


## Billing Architecture

<p align="center">
  <img src="/assets/header-2.png" alt="AI Billing Header 2">
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
| [**DeepSeek**](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek) | [`@ai-billing/deepseek`](https://www.npmjs.com/package/@ai-billing/deepseek) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fdeepseek) |
| [**Chutes**](https://ai-sdk.dev/providers/community-providers/chutes) | [`@ai-billing/chutes`](https://www.npmjs.com/package/@ai-billing/chutes) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fchutes) |

### Supported Destinations

| Destination | Package | Size |
| :--- | :--- | :--- |
| **Polar.sh** | [`@ai-billing/polar`](https://www.npmjs.com/package/@ai-billing/polar) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fpolar) |
| **Stripe** | [`@ai-billing/stripe`](https://www.npmjs.com/package/@ai-billing/stripe) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fstripe) |
| **OpenMeter** (Kong) | [`@ai-billing/openmeter`](https://www.npmjs.com/package/@ai-billing/openmeter) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fopenmeter) |
| **Lago** | [`@ai-billing/lago`](https://www.npmjs.com/package/@ai-billing/lago) | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Flago) |

## UI Components

Explore the full component library in [Storybook](https://ai-billing-storybook.vercel.app/).


| Component | Preview |
| :--- | :--- |
| `<CreditTopUpPolar>` | <img src="/assets/topup-component.png" alt="CreditTopUpPolar component preview from @ai-billing/nextjs" width="320"> |
| `<CreditUsagePolar>` | <img src="/assets/usage-component.png" alt="CreditUsagePolar component preview from @ai-billing/nextjs" width="320"> |


### SDKs

| Package | Description | Size |
| :--- | :--- | :--- |
| [`@ai-billing/nextjs`](https://www.npmjs.com/package/@ai-billing/nextjs) | Next.js UI components for displaying billing usage and managing top-ups. | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fnextjs) |
| [`@ai-billing/ui`](https://www.npmjs.com/package/@ai-billing/ui) | Internal headless UI components shared across `@ai-billing/*` packages. | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fui) |
| [`@ai-billing/narev`](https://www.npmjs.com/package/@ai-billing/narev) | TypeScript SDK for the [Narev](https://narev.ai) billing API. | ![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40ai-billing%2Fnarev) |

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