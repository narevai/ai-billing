# @ai-billing/narev

TypeScript SDK for the [Narev](https://narev.ai) billing API.

## Install

```bash
npm install @ai-billing/narev
```

## Usage

```ts
import { createNarevClient } from '@ai-billing/narev';

const narev = createNarevClient({ apiKey: process.env.NAREV_API_KEY });

// Balance
const { data } = await narev.getBalance('user_123');
console.log(data.unitsConsumed, data.meterName);

// Top-up packages
const config = await narev.getCreditConfig();
console.log(config.data.packages);

// Checkout
const checkout = await narev.createCheckout({
  productId: 'prod_xxx',
  userId: 'user_123',
  successUrl: 'https://myapp.com/billing/success',
});
window.location.href = checkout.data.url;
```
