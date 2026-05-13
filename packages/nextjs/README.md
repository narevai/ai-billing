# @ai-billing/nextjs

Next.js UI components for displaying billing usage and managing top-ups.

```bash
npm install @ai-billing/nextjs
```

## Components

Import client components from the main entry:

```tsx
import { CreditUsagePolar, CreditUsageStripe, CreditTopUpPolar } from '@ai-billing/nextjs';

<CreditUsagePolar userId="user_123" budget={50} />
<CreditUsageStripe stripeCustomerId="cus_123" budget={100} />
<CreditTopUpPolar userId="user_123" />
```

### budget vs top-up

- **`budget`** — use when billing is usage-based (e.g. monthly invoice per consumption). Represents a spending cap. The bar shows how much of the cap has been consumed.
- **No `budget`** — use together with `CreditTopUpPolar` when users pre-purchase credits. Omit `budget` and the cap is automatically set to the account's `creditedUnits` from Polar.

Server actions for advanced use cases:

```tsx
import { fetchPolarUsage, fetchStripeUsage, createCheckout } from '@ai-billing/nextjs/server';
```

## Theming

Components use CSS custom properties for styling. Override them via `className`:

```css
.my-card {
  --card: #0c0a09;
  --card-foreground: #fafaf9;
  --foreground: #fbbf24;
  --muted: #292524;
  --border: #44403c;
  --primary: #f59e0b;
  --primary-foreground: #0c0a09;
}
```

## Documentation

For full usage instructions, see the [Documentation](https://www.narev.ai/docs/sdk/ai-billing).
