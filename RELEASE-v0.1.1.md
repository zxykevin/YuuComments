# YuuComments v0.1.1

This is a deployment-focused patch release. It moves the backend deployment entry point to a cross-platform TypeScript script and fixes the Windows first-deploy experience.

## Highlights

- Added `scripts/deploy-backend.ts` as the cross-platform backend deployment script.
- Updated `pnpm deploy:backend` to run `tsx scripts/deploy-backend.ts`.
- Kept the original `worker/deploy-backend.ps1`; the PowerShell script is still available for manual use.
- Fixed Windows child-process startup by avoiding direct `pnpm.cmd` spawning where it can fail with `spawnSync EINVAL`.
- Masked sensitive deploy prompts with `*`, so pasted API tokens give visible feedback without printing secrets.
- Kept temporary secrets files behind `try/finally` cleanup.
- Fixed garbled Chinese text in Worker 405 responses.

## Deployment

Recommended command:

```bash
pnpm deploy:backend
```

Optional arguments:

```bash
pnpm deploy:backend -- --skip-install
pnpm deploy:backend -- --secrets-file secrets.production.json
```

The deployment flow remains aligned with the original PowerShell script:

- Check Cloudflare login.
- Install dependencies unless skipped.
- Check or create the D1 database and write back `database_id`.
- Check and upload Worker secrets.
- Create or read the Turnstile widget.
- Add configured CORS hostnames.
- Run TypeScript checks.
- Apply remote D1 migrations.
- Deploy the Worker.
- Generate `dist/frontend/`, `dist/astro/`, and `dist/admin/` artifacts.

## Notes

- The deploy script still modifies real Cloudflare resources before Worker deploy, including D1 databases, Turnstile widgets, Worker secrets, and remote D1 migrations.
- `ADMIN_TOKEN` is generated on first setup when missing and is printed once in the terminal. Save it somewhere safe.
- Cloudflare API tokens and Turnstile secrets are not printed in plaintext.

## Verification

Checked before release:

- Real Windows deployment test from a freshly downloaded repository passed.
- `pnpm typecheck` passed.
- `pnpm exec tsc --noEmit` passed.
- `node --check` passed on generated JavaScript for the deploy script.
