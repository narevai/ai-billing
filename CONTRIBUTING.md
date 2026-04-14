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

## Release notes

This project uses **Changesets** for versioning and GitHub Actions with **OIDC (Verified Publisher)** to automate npm releases.

### 1. Create a feature change

Never commit version bumps manually. All releases start with a changeset ("message of intent").

1. Create a feature branch: `git checkout -b feat/my-new-feature`.
2. Make your code changes.
3. Generate a changeset at the repository root:
   ```bash
   pnpm changeset
   ```
4. Follow the interactive prompts:
   - Select packages to bump (use spacebar).
   - Select bump type (major, minor, patch).
   - Write a summary for the changelog.
5. Commit the generated `.md` file in `.changeset/` with your code.
6. Open a PR and merge it into `main`.

### 2. Automated version PR

After feature changesets are merged into `main`, the release workflow runs automatically:

1. GitHub Action detects new `.changeset/*.md` files.
2. It does **not** publish immediately.
3. It opens or updates a PR titled `chore(release): version packages`.
4. That PR contains version bumps in `package.json` and updated changelog entries.

You can merge multiple feature PRs first; the release PR is updated with all accumulated changes.

### 3. Publish to npm

To finalize a release:

1. Review the `chore(release): version packages` PR.
2. Merge it into `main`.
3. The workflow runs again, detects consumed changesets, and publishes packages.

Security note: publishing uses OIDC, so `NPM_TOKEN` is not required for CI publishing.

### Maintenance and special commands

#### Pre-release mode

Pre-release versions may look like `0.0.1-alpha.x`.

- Exit alpha mode and return to stable flow:
  ```bash
  pnpm changeset pre exit
  ```
- Enter a new pre-release tag (example: beta):
  ```bash
  pnpm changeset pre enter beta
  ```

#### Troubleshooting "stuck" states

If the workflow fails to open a PR or reports "No changesets found", check for a stale `.changeset/*.md` file already referenced in `.changeset/pre.json` and remove it if needed.
