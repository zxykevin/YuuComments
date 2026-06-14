# YuuComments v0.1.5

This release improves spam moderation with source bans.

此版本通过评论来源封禁改进垃圾评论审核流程。

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
- Added a repeatable `pnpm build` command for generating current frontend, Admin, and Astro assets.
- Added generated asset verification to prevent publishing a comment widget without device fingerprint submission logic.

## 新功能

- 新增 `comment_bans` D1 数据表。
- 新增后台“标记垃圾并封禁”操作。
- 新增 IP hash 封禁支持。
- 新增设备指纹封禁支持。
- 新增评论创建前的封禁检查。
- 改进垃圾评论审核流程。
- 使用按钮式目标和原因选择改进 Spam & Ban 界面。
- 新增后台 Bans 视图，用于查看已封禁的 IP 和设备来源。
- 新增 `GET /api/admin/bans`。
- 新增 `DELETE /api/admin/bans/:id`，用于解除来源封禁。
- 新增后台中英文切换，并在本地保存所选语言。
- 在后台 Bans 视图中，将关联的 IP 和设备封禁合并为一张 Both 卡片。
- 新增可重复执行的 `pnpm build` 命令，用于生成当前版本的前端、后台和 Astro 静态资源。
- 新增生成资源校验，防止发布缺少设备指纹提交逻辑的评论组件。

Device fingerprints are lightweight SHA-256 hashes generated in the browser from common browser and screen properties. Raw device information is not sent to the backend.

The Admin Bans view displays shortened hashes instead of raw IP addresses. A Both card represents two underlying ban records and unbans both sources when removed.

设备指纹是在浏览器中根据常见浏览器和屏幕属性生成的轻量 SHA-256 hash。原始设备信息不会发送到后端。

后台 Bans 视图显示缩短后的 hash，而不是明文 IP。Both 卡片对应两条底层封禁记录，解除该卡片会同时解除两个来源的封禁。

## Security and Privacy Notes

- Device fingerprints are client-provided moderation signals and can be omitted or spoofed.
- IP hash bans can affect multiple users sharing one public network.
- Unsalted IP hashes should not be treated as anonymous data.
- The existing raw `comments.ip` field remains for backward compatibility, while Spam & Ban uses `ip_hash` as its ban value.

## 安全与隐私说明

- 设备指纹是客户端提供的审核信号，客户端可以省略或伪造该值。
- IP hash 封禁可能影响共享同一公网网络的多个用户。
- 不应将未加盐的 IP hash 视为匿名数据。
- 现有明文 `comments.ip` 字段为兼容性保留，Spam & Ban 使用 `ip_hash` 作为封禁值。

## API

```text
POST /api/admin/comments/:id/spam-ban
GET /api/admin/bans
DELETE /api/admin/bans/:id
```

Example request:

请求示例：

```json
{
  "banIp": true,
  "banDevice": true,
  "reason": "Spam comment"
}
```

## Upgrade Notes

Existing deployments must apply the new D1 migration before using Spam & Ban:

现有部署在使用 Spam & Ban 前必须应用新的 D1 migration：

```bash
pnpm db:migrate:remote
```

For local development:

本地开发环境：

```bash
pnpm db:migrate:local
```

After deploying the Worker, publish the updated frontend and admin assets.

The one-command deployment flow performs the migration, Worker deployment, and static asset generation:

部署 Worker 后，需要发布更新后的 frontend 和 admin 静态资源。

一键部署流程会执行 migration、部署 Worker，并生成静态资源：

```bash
pnpm deploy:backend
```

## Release Verification / 发布验证

- `pnpm db:migrate:local`
- `pnpm typecheck`
- `node --check admin/admin.js`
- `node --check frontend/vanilla/comments.js`
- `pnpm exec wrangler deploy --dry-run --config worker/wrangler.toml`

Manual release checks / 手动发布检查：

- Submit a normal comment and confirm it remains visible.
- Mark a comment as spam and ban Device, IP, and Both targets.
- Confirm banned sources receive HTTP `403` when posting again.
- Confirm Both bans display as one Admin card and Unban removes both records.
- Confirm the Admin language switch updates Comments, Reports, Bans, and the Spam & Ban dialog.
- Confirm public comment lists still return only `approved` comments.

- 提交普通评论并确认评论仍可正常显示。
- 将评论标记为垃圾，并分别测试 Device、IP 和 Both 封禁目标。
- 确认被封禁来源再次提交评论时收到 HTTP `403`。
- 确认 Both 封禁显示为一张后台卡片，解除封禁会删除两条记录。
- 确认后台语言切换会更新评论、举报、封禁和 Spam & Ban 对话框。
- 确认公开评论列表仍然只返回 `approved` 评论。
