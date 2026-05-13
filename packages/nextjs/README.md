# @ai-billing/nextjs

Next.js UI components for displaying billing usage and managing top-ups.

```bash
npm install @ai-billing/nextjs
```

## Polar

Display usage for Polar meters and let users purchase credit bundles.

```tsx
import { CreditUsagePolar, CreditTopUpPolar } from '@ai-billing/nextjs';

<CreditUsagePolar userId="user_123" budget={50} />
<CreditTopUpPolar userId="user_123" />
```

### budget vs top-up

- **`budget`** — use when billing is usage-based (e.g. monthly invoice per consumption). Represents a spending cap.
- **No `budget`** — use together with `CreditTopUpPolar` when users pre-purchase credits. Omit `budget` and the cap is automatically set to the account's `creditedUnits`.

### Environment Variables

| Variable | Required |
|----------|----------|
| `NAREV_API_KEY` | Config fetch |
| `POLAR_ACCESS_TOKEN` | Meter usage + top-up |
| `POLAR_SERVER` | `sandbox` or `production` |

## Stripe

Display usage for Stripe billing meters.

```tsx
import { CreditUsageStripe } from '@ai-billing/nextjs';

<CreditUsageStripe stripeCustomerId="cus_123" budget={100} unit="$" />
```

Stripe meters report values in nano-units. The component converts them to dollars and displays them with `$` formatting by default. Use the `unit` prop to override.

### Environment Variables

| Variable | Required |
|----------|----------|
| `NAREV_API_KEY` | Config fetch |
| `STRIPE_SECRET_KEY` | Meter usage |

## Server Actions

Server actions are available for advanced use cases:

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
