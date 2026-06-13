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

Device fingerprints are lightweight SHA-256 hashes generated in the browser from common browser and screen properties. Raw device information is not sent to the backend.

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
