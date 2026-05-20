# YuuComments v0.1.2

This is an urgent deployment bugfix release.

## Fixes

- Fixed Worker API URL detection in `scripts/deploy-backend.ts`.
- The deploy script now only accepts deployed Worker URLs ending in `.workers.dev` when generating frontend and admin bundles.
- This prevents Wrangler informational links, such as telemetry documentation URLs, from being written into `dist/frontend/yuucomments.config.js` as `apiBase`.

## Impact

Before this release, `pnpm deploy:backend` could generate a broken frontend config when Wrangler printed a documentation URL before the deployed Worker URL. Static site demos using the generated `/comments/yuucomments.config.js` would then show comment load and submit failures even though Turnstile succeeded.

After this release, generated frontend bundles point at the actual Worker API URL.

## Verification

Checked before release:

- `pnpm typecheck` passed.
- Real Worker API request returned `{"ok":true,"comments":[]}`.
- A generated frontend config was verified to contain the deployed Worker URL instead of a Wrangler documentation URL.
