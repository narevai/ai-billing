# Contributing

## Generate docs

This repository uses `pnpm` and Turbo to generate docs.

From the repository root:

```bash
pnpm run docs
```

What this runs:

- Turbo runs dependency docs tasks first (for example `@ai-billing/core#docs:generate`)
- then runs `docs#docs:generate` (`apps/docs/scripts/generate.mjs`) to normalize generated files and update docs navigation

## Preview docs locally

From `apps/docs`:

```bash
pnpm run dev
```

