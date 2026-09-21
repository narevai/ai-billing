![ai-billing](/assets/logo.svg)

# [ai-billing](https://github.com/narevai/ai-billing)



**Usage-based billing for the Vercel AI SDK.**

Turn every LLM request into a dollar cost, attach it to a customer, and send it to Stripe, Polar, OpenMeter, or Lago.

![Codecov](https://img.shields.io/codecov/c/github/narevai/ai-billing?style=for-the-badge&labelColor=000000) [](https://www.npmjs.com/package/@ai-billing/core)![Node version](https://img.shields.io/node/v/%40ai-billing%2Fcore?style=for-the-badge&labelColor=000000)[ ](https://www.npmjs.com/package/@ai-billing/core)![NPM license](https://img.shields.io/npm/l/%40ai-billing%2Fcore?style=for-the-badge&labelColor=000000)[ ](https://www.npmjs.com/package/@ai-billing/core)![Discord chat](https://img.shields.io/badge/chat-on%20discord-7289DA.svg?style=for-the-badge&logo=discord&labelColor=000000)[

---



## What it does

The Vercel AI SDK gives you token usage.

`ai-billing` turns that usage into billing.

```text
streamText()
    ↓
token usage
    ↓
$0.000142
    ↓
customer cus_123
    ↓
Stripe / Polar / OpenMeter / Lago
```

Every LLM call can:

- calculate its cost in USD
- expose that cost on the AI SDK response
- associate usage with your customer
- send a normalized billing event to your billing system

No separate token-accounting pipeline required.

### Without ai-billing

```json
{
  "text": "Hello! How can I help?",
  "usage": {
    "inputTokens": 8,
    "outputTokens": 12
  }
}
```



### With ai-billing

```json
{
  "text": "Hello! How can I help?",
  "usage": {
    "inputTokens": 8,
    "outputTokens": 12
  },
  "providerMetadata": {
    "ai-billing": {
      "cost": {
        "amount": 0.000142,
        "currency": "USD"
      }
    }
  }
}
```

And a billing event is sent for the customer attached to the request.

![ai-billing adds cost to every response](/assets/header-1.png)

![ai-billing sends events to billing destinations](/assets/header-2.png)

---



## Quick start

Install the provider and billing destination you use:

```bash
pnpm add @ai-billing/core @ai-billing/openai @ai-billing/stripe
```

Create the middleware:

```typescript
import { createOpenAIV3Middleware } from '@ai-billing/openai';
import { createStripeDestination } from '@ai-billing/stripe';

const billingMiddleware = createOpenAIV3Middleware({
  destinations: [
    createStripeDestination({
      apiKey: process.env.STRIPE_SECRET_KEY!,
      meterName: 'llm_usage',
    }),
  ],
});
```

Then wrap your model:

```diff
-import { streamText } from 'ai';
+import { streamText, wrapLanguageModel } from 'ai';

await streamText({
-  model: openai('gpt-4o'),
+  model: wrapLanguageModel({
+    model: openai('gpt-4o'),
+    middleware: billingMiddleware,
+  }),

   messages: [
     { role: 'user', content: 'Hello' },
   ],

+  providerOptions: {
+    'ai-billing-tags': {
+      stripe_customer_id: 'cus_123',
+    },
+  },
});
```

That's it.

The response now contains the dollar cost of the generation and the corresponding billing event is sent to Stripe.

---



## Full example

```typescript
import { streamText, wrapLanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { createOpenAIV3Middleware } from '@ai-billing/openai';
import { createStripeDestination } from '@ai-billing/stripe';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const billingMiddleware = createOpenAIV3Middleware({
  destinations: [
    createStripeDestination({
      apiKey: process.env.STRIPE_SECRET_KEY!,
      meterName: 'llm_usage',
    }),
  ],
});

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: billingMiddleware,
});

await streamText({
  model,

  messages: [
    { role: 'user', content: 'Hello' },
  ],

  providerOptions: {
    'ai-billing-tags': {
      stripe_customer_id: 'cus_123',
    },
  },
});
```

A complete application is available here:


| Example                  | Repo                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Chatbot with Billing** | [examples/chatbot-with-billing](https://github.com/narevai/ai-billing/tree/main/examples/chatbot-with-billing) |


---



## Why ai-billing?

Billing LLM usage looks simple until you need to support multiple models and providers.

Different providers return different usage metadata. Different models have different input, output, and cache pricing. Your application still has to convert that into a consistent billing event and associate it with the right customer.

`ai-billing` keeps that logic at the model boundary.

Your application calls the Vercel AI SDK as usual.

The middleware handles:

```text
provider usage
      ↓
normalized usage
      ↓
model pricing
      ↓
cost
      ↓
billing event
      ↓
billing destination
```

Provider-specific pricing and usage logic stays out of your application code.

---



## Supported providers

Use the provider package matching your existing AI SDK provider.


| Provider                                                                                       | Package                                                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **[OpenRouter](https://ai-sdk.dev/providers/community-providers/openrouter)**                  | `[@ai-billing/openrouter](https://www.npmjs.com/package/@ai-billing/openrouter)`               |
| **[OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai)**                             | `[@ai-billing/openai](https://www.npmjs.com/package/@ai-billing/openai)`                       |
| **[Vercel AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)**              | `[@ai-billing/gateway](https://www.npmjs.com/package/@ai-billing/gateway)`                     |
| **[OpenAI Compatible](https://ai-sdk.dev/providers/openai-compatible-providers)**              | `[@ai-billing/openai-compatible](https://www.npmjs.com/package/@ai-billing/openai-compatible)` |
| **[Groq](https://ai-sdk.dev/providers/ai-sdk-providers/groq)**                                 | `[@ai-billing/groq](https://www.npmjs.com/package/@ai-billing/groq)`                           |
| **[Google Generative AI](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)** | `[@ai-billing/google](https://www.npmjs.com/package/@ai-billing/google)`                       |
| **[Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)**                       | `[@ai-billing/anthropic](https://www.npmjs.com/package/@ai-billing/anthropic)`                 |
| **[xAI Grok](https://ai-sdk.dev/providers/ai-sdk-providers/xai)**                              | `[@ai-billing/xai](https://www.npmjs.com/package/@ai-billing/xai)`                             |
| **[MiniMax](https://ai-sdk.dev/providers/community-providers/minimax)**                        | `[@ai-billing/minimax](https://www.npmjs.com/package/@ai-billing/minimax)`                     |
| **[DeepSeek](https://ai-sdk.dev/providers/ai-sdk-providers/deepseek)**                         | `[@ai-billing/deepseek](https://www.npmjs.com/package/@ai-billing/deepseek)`                   |
| **[Chutes](https://ai-sdk.dev/providers/community-providers/chutes)**                          | `[@ai-billing/chutes](https://www.npmjs.com/package/@ai-billing/chutes)`                       |
| **[Alibaba](https://ai-sdk.dev/providers/ai-sdk-providers/alibaba)**                           | `[@ai-billing/alibaba](https://www.npmjs.com/package/@ai-billing/alibaba)`                     |
| **[Amazon Bedrock](https://ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock)**             | `[@ai-billing/amazon-bedrock](https://www.npmjs.com/package/@ai-billing/amazon-bedrock)`       |
| **[Azure](https://ai-sdk.dev/providers/ai-sdk-providers/azure)**                               | `[@ai-billing/azure](https://www.npmjs.com/package/@ai-billing/azure)`                         |
| **[Baseten](https://ai-sdk.dev/providers/ai-sdk-providers/baseten)**                           | `[@ai-billing/baseten](https://www.npmjs.com/package/@ai-billing/baseten)`                     |
| **[Cerebras](https://ai-sdk.dev/providers/ai-sdk-providers/cerebras)**                         | `[@ai-billing/cerebras](https://www.npmjs.com/package/@ai-billing/cerebras)`                   |
| **[Cohere](https://ai-sdk.dev/providers/ai-sdk-providers/cohere)**                             | `[@ai-billing/cohere](https://www.npmjs.com/package/@ai-billing/cohere)`                       |
| **[DeepInfra](https://ai-sdk.dev/providers/ai-sdk-providers/deepinfra)**                       | `[@ai-billing/deepinfra](https://www.npmjs.com/package/@ai-billing/deepinfra)`                 |
| **[Fireworks](https://ai-sdk.dev/providers/ai-sdk-providers/fireworks)**                       | `[@ai-billing/fireworks](https://www.npmjs.com/package/@ai-billing/fireworks)`                 |
| **[GMI Cloud](https://ai-sdk.dev/providers/community-providers/gmicloud)**                     | `[@ai-billing/gmicloud](https://www.npmjs.com/package/@ai-billing/gmicloud)`                   |
| **[Google Vertex AI](https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex)**            | `[@ai-billing/google-vertex](https://www.npmjs.com/package/@ai-billing/google-vertex)`         |
| **[Hugging Face](https://ai-sdk.dev/providers/ai-sdk-providers/huggingface)**                  | `[@ai-billing/huggingface](https://www.npmjs.com/package/@ai-billing/huggingface)`             |
| **[Mistral](https://ai-sdk.dev/providers/ai-sdk-providers/mistral)**                           | `[@ai-billing/mistral](https://www.npmjs.com/package/@ai-billing/mistral)`                     |
| **[Moonshot AI](https://ai-sdk.dev/providers/ai-sdk-providers/moonshotai)**                    | `[@ai-billing/moonshotai](https://www.npmjs.com/package/@ai-billing/moonshotai)`               |
| **[Perplexity](https://ai-sdk.dev/providers/ai-sdk-providers/perplexity)**                     | `[@ai-billing/perplexity](https://www.npmjs.com/package/@ai-billing/perplexity)`               |
| **[Together.ai](https://ai-sdk.dev/providers/ai-sdk-providers/togetherai)**                    | `[@ai-billing/togetherai](https://www.npmjs.com/package/@ai-billing/togetherai)`               |
| **[Z.AI](https://ai-sdk.dev/providers/ai-sdk-providers/zai)**                                  | `[@ai-billing/zai](https://www.npmjs.com/package/@ai-billing/zai)`                             |


---



## Billing destinations

Provider middleware emits a normalized `BillingEvent`.

Destinations decide where that event goes.


| Destination   | Package                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| **Stripe**    | `[@ai-billing/stripe](https://www.npmjs.com/package/@ai-billing/stripe)`       |
| **Polar.sh**  | `[@ai-billing/polar](https://www.npmjs.com/package/@ai-billing/polar)`         |
| **OpenMeter** | `[@ai-billing/openmeter](https://www.npmjs.com/package/@ai-billing/openmeter)` |
| **Lago**      | `[@ai-billing/lago](https://www.npmjs.com/package/@ai-billing/lago)`           |


Provider and destination packages are independent.

For example:

```text
OpenAI ─────┐
Anthropic ──┤
OpenRouter ─┤
DeepSeek ───┤
            ├── ai-billing ── Stripe
Groq ───────┤              ├─ Polar
Bedrock ────┤              ├─ OpenMeter
Vertex AI ──┤              └─ Lago
... ────────┘
```

---



## Custom pricing

Provider middleware includes provider-specific cost calculation and supports `PriceResolver` for supplying custom prices at request time.

Use custom prices when the amount you want to meter differs from the provider's default model pricing.

---



## UI components

`ai-billing` also ships components for usage-based billing interfaces.

Explore the full component library in [Storybook](https://ai-billing-storybook.vercel.app/).


| Component            | Preview                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `<CreditTopUpPolar>` | ![CreditTopUpPolar component preview from @ai-billing/nextjs](/assets/topup-component.png) |
| `<CreditUsagePolar>` | ![CreditUsagePolar component preview from @ai-billing/nextjs](/assets/usage-component.png) |




### SDKs


| Package                                                                  | Description                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `[@ai-billing/nextjs](https://www.npmjs.com/package/@ai-billing/nextjs)` | Next.js UI components for displaying billing usage and managing top-ups. |
| `[@ai-billing/ui](https://www.npmjs.com/package/@ai-billing/ui)`         | Headless UI components shared across `@ai-billing/*` packages.           |
| `[@ai-billing/narev](https://www.npmjs.com/package/@ai-billing/narev)`   | TypeScript SDK for the [Narev](https://narev.ai) billing API.            |


---



## Architecture

`ai-billing` has two main layers.

### Provider middleware

Provider middleware is specialized for individual `@ai-sdk/*` packages.

It handles:

- provider-specific usage metadata
- provider-specific cost calculation
- normalization into a common billing format
- custom pricing through `PriceResolver`



### Destinations

Destinations receive a normalized `BillingEvent` and send it to external billing systems.

That separation lets the same provider integration work with multiple billing systems without putting provider-specific logic into your application.

---



## Status and roadmap

> **Note:** We are currently prioritizing support for text models.

The full list of Vercel AI SDK providers is available at [ai-sdk.dev/providers](https://ai-sdk.dev/providers/).

Need another provider or destination?

[Open a GitHub issue](https://github.com/narevai/ai-billing/issues).