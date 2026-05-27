# YuuComments v0.1.3

> This release adds anonymous comment likes for the Worker API, frontend widget, and admin dashboard.
> 此版本为 Worker API、前端评论组件和管理后台新增匿名评论点赞支持。

## Features / 新功能

- Added `comment_likes` D1 table for storing one like per anonymous visitor and comment.  
  新增 `comment_likes` D1 表，用于保存每个匿名访问者对每条评论的一次点赞。
- Added like and unlike APIs for approved comments only.  
  新增点赞和取消点赞 API，且仅允许对已通过审核的评论操作。
- `GET /api/comments?path=/xxx` now returns `likeCount` and `liked` for each comment.  
  `GET /api/comments?path=/xxx` 现在会为每条评论返回 `likeCount` 和 `liked`。
- Added a lightweight vanilla frontend like button for each comment.  
  为每条评论新增轻量原生前端点赞按钮。
- The admin dashboard now displays comment like counts.
  管理后台现在会显示评论点赞数。

## APIs / 接口

```text
POST   /api/comments/:id/like
DELETE /api/comments/:id/like
```

Successful responses:

成功响应：

```json
{
  "ok": true,
  "commentId": "comment-id",
  "likeCount": 1,
  "liked": true
}
```

## Privacy / 隐私

- Likes are limited by a one-way hash derived from the request IP and User-Agent.  
  点赞限制基于请求 IP 和 User-Agent 生成的单向哈希。
- Raw IP addresses and raw User-Agent values are not stored in `comment_likes` and are not exposed by the like APIs.  
  `comment_likes` 不保存原始 IP 或原始 User-Agent，点赞 API 也不会暴露这些信息。
- This is not a strong identity system. Changing devices, browsers, or networks may be treated as a different visitor.
  这不是强身份系统。换设备、换浏览器或换网络可能被视为不同访问者。

## Upgrade Notes / 升级说明

- New deployments using the current `schema.sql` or the one-command deployment flow do not need manual schema edits.
  新部署用户使用当前 `schema.sql` 或一键部署流程即可，不需要手动修改 schema。
- Existing deployments must apply the new D1 migration before using likes.
  旧版本升级用户需要先执行新增 D1 migration，才能使用点赞功能。

## Migration / 数据迁移

Apply the new D1 migration before using the like APIs:

使用点赞 API 前，请先执行新的 D1 migration：

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

发布前已完成以下检查：

- `pnpm typecheck` passed.  
  `pnpm typecheck` 已通过。
