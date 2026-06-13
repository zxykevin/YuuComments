# YuuComments v0.1.5

This release improves spam moderation with source bans.

## Features

- Added the `comment_bans` D1 table.
- Added the admin Mark spam & ban action.
- Added IP hash ban support.
- Added device fingerprint ban support.
- Added ban checks before comment creation.
- Improved the moderation workflow for spam comments.
- Improved Spam & Ban UI with button-based target and reason selection.
- Added Admin Bans view for reviewing blocked IP/device bans.
- Added `GET /api/admin/bans`.
- Added `DELETE /api/admin/bans/:id` for unbanning sources.
- Added English and Chinese Admin UI switching with the selected language stored locally.
- Combined related IP and device bans into one Both card in the Admin Bans view.

Device fingerprints are lightweight SHA-256 hashes generated in the browser from common browser and screen properties. Raw device information is not sent to the backend.

The Admin Bans view displays shortened hashes instead of raw IP addresses. A Both card represents two underlying ban records and unbans both sources when removed.

## Security and Privacy Notes

- Device fingerprints are client-provided moderation signals and can be omitted or spoofed.
- IP hash bans can affect multiple users sharing one public network.
- Unsalted IP hashes should not be treated as anonymous data.
- The existing raw `comments.ip` field remains for backward compatibility, while Spam & Ban uses `ip_hash` as its ban value.

## API

```text
POST /api/admin/comments/:id/spam-ban
GET /api/admin/bans
DELETE /api/admin/bans/:id
```

Example request:

```json
{
  "banIp": true,
  "banDevice": true,
  "reason": "Spam comment"
}
```

## Upgrade Notes

Existing deployments must apply the new D1 migration before using Spam & Ban:

```bash
pnpm db:migrate:remote
```

For local development:

```bash
pnpm db:migrate:local
```

After deploying the Worker, publish the updated frontend and admin assets.

The one-command deployment flow performs the migration, Worker deployment, and static asset generation:

```bash
pnpm deploy:backend
```

## Release Verification

- `pnpm db:migrate:local`
- `pnpm typecheck`
- `node --check admin/admin.js`
- `node --check frontend/vanilla/comments.js`
- `pnpm exec wrangler deploy --dry-run --config worker/wrangler.toml`

Manual release checks:

- Submit a normal comment and confirm it remains visible.
- Mark a comment as spam and ban Device, IP, and Both targets.
- Confirm banned sources receive HTTP `403` when posting again.
- Confirm Both bans display as one Admin card and Unban removes both records.
- Confirm the Admin language switch updates Comments, Reports, Bans, and the Spam & Ban dialog.
- Confirm public comment lists still return only `approved` comments.
