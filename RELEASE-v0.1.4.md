# YuuComments v0.1.4

This release adds a complete lightweight reporting workflow and safe Markdown / KaTeX rendering for comments.

此版本新增完整的轻量举报流程，并支持安全的 Markdown 评论与 KaTeX 数学公式渲染。

## Features / 新功能

- Added safe Markdown rendering for comment content.
  新增安全 Markdown 评论渲染。
- Added LaTeX math rendering with KaTeX.
  新增基于 KaTeX 的 LaTeX 数学公式渲染。
- Added comment reporting for public comments.
  新增评论举报功能。
- Reporters are required to provide an email address.
  举报者必须填写邮箱地址。
- Added admin report management.
  新增后台举报管理。
- Admins can resolve or ignore reports.
  管理员可以将举报标记为已处理或忽略。
- Admins can delete reported comments from the reports view.
  管理员可以在举报视图中删除被举报评论。
- Comments are automatically moved from `approved` to `pending` after 5 reports.
  评论累计收到 5 次举报后，如果当前状态为 `approved`，会自动转回 `pending`。

## APIs / 接口

```text
POST  /api/comments/:id/report
GET   /api/admin/reports?status=open
PATCH /api/admin/reports/:id/status
```

Public report request body:

公开举报请求体：

```json
{
  "email": "reporter@example.com",
  "reason": "spam",
  "message": "optional details"
}
```

Admin report status request body:

后台举报状态请求体：

```json
{
  "status": "resolved"
}
```

## Data / 数据

- Added the `comment_reports` D1 table.
  新增 `comment_reports` D1 表。
- Reporter email is stored in plain text and visible to site admins.
  举报者邮箱会以明文保存，并且站点管理员可以在后台查看。
- Duplicate reports from the same anonymous visitor are prevented by `reporter_hash`.
  系统使用 `reporter_hash` 防止同一个匿名访客重复举报同一条评论。
- Duplicate reports from the same email address for the same comment are prevented.
  同一个邮箱不能重复举报同一条评论。
- No raw IP address or raw User-Agent is stored for reports.
  举报记录不会保存原始 IP 或原始 User-Agent。

## Not Included / 未包含

- No IP banning.
  不包含 IP 封禁。
- No device banning.
  不包含设备封禁。
- No email notifications.
  不包含邮件通知。
- No AI moderation.
  不包含 AI 审核。
- No automatic deletion.
  不会自动删除评论。

## Upgrade Notes / 升级说明

- New deployments using the current migrations or the one-command deployment flow do not need manual schema edits.
  新部署用户使用当前 migrations 或一键部署流程即可，不需要手动修改 schema。
- Existing deployments must apply the new D1 migration before using reports.
  旧版本升级用户需要先执行新的 D1 migration，才能使用举报功能。

```bash
pnpm db:migrate:remote
```

For local development:

本地开发可执行：

```bash
pnpm db:migrate:local
```

## Verification / 验证

Checked before release:

发布前已检查：

- `pnpm typecheck` passed.
  `pnpm typecheck` 已通过。
