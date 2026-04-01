## Release Guide

This project uses **Changesets** to manage versioning and **GitHub Actions** with **OIDC (Verified Publisher)** to automate NPM releases.

### 1. Create a Feature Change
Never commit version bumps manually. All releases start with a "Message of Intent" (a changeset).

1.  Create a feature branch: `git checkout -b feat/my-new-feature`.
2.  Make your code changes.
3.  Generate a changeset at the root:
    ```bash
    pnpm changeset
    ```
4.  Follow the interactive prompts:
    * **Select packages** to bump (use spacebar).
    * **Select bump type** (major -> minor -> patch).
    * **Write a summary** for the changelog.
5.  Commit the generated `.md` file in the `.changeset` folder along with your code.
6.  Open a PR and merge it into `main`.

---

### 2. The Automated "Version PR"
Once your feature is merged into `main`, the **Release Workflow** triggers automatically:

1.  The GitHub Action detects the new `.md` file.
2.  It **will not** publish to NPM yet.
3.  Instead, it creates a new Pull Request titled **`chore(release): version packages`**.
4.  This PR contains the version bumps in `package.json` and the updated `CHANGELOG.md`.

> You can merge multiple feature PRs into `main` first. The Action will simply update the existing "Version Packages" PR with all the accumulated changes.

---

### 3. Publishing to NPM
To finalize the release and push to the registry:

1.  Review the **`chore(release): version packages`** PR.
2.  **Merge it into `main`**.
3.  The Action runs one last time, detects that the changeset files are gone, and executes the publish command.
4.  **Security:** This project uses **OIDC (OpenID Connect)**. No `NPM_TOKEN` is required; GitHub handshakes directly with NPM to verify the publisher identity.

---

### Maintenance & Special Commands

#### Pre-release (Alpha) Mode
The project is currently in **pre-release mode**. Versions will look like `0.0.1-alpha.x`. 
* To **exit** alpha mode and move to stable releases:
    ```bash
    pnpm changeset pre exit
    ```
* To **enter** a new pre-release tag (e.g., beta):
    ```bash
    pnpm changeset pre enter beta
    ```

#### Troubleshooting "Stuck" States
If the Action fails to open a PR or complains about "No changesets found", check if a "zombie" `.md` file exists in `.changeset/` that is already listed in `pre.json`. Delete it manually.

---

## Release

### Publish new package
```bash
npm login
npm publish --dry-run
```

Make sure the version is correct in the `package.json`.

When ready:

```bash
npm publish --access public --tag alpha
```
