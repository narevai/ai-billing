# @ai-billing/ui

Internal headless UI components shared across `@ai-billing/*` packages. 

## Exports

| Component | Description |
|---|---|
| `UsageBar` | Usage value with optional progress bar and cap |
| `CreditPackagePicker` | Selectable list of credit packages with a purchase button |
| `EmptyCard` | Card shell with a muted message, used as a fallback |
| `EmptyMessage` | Bare muted message, for embedding inside an existing card |

All components use CSS custom properties (`--card`, `--border`, `--primary`, `--muted`, `--radius`, etc.) and accept standard `HTMLDivElement` props including `className`, `style`, and `ref`.
