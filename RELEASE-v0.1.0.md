# YuuComments v0.1.0

YuuComments 的第一个可用版本。这个版本提供了一个基于 Cloudflare Workers、D1 和 Turnstile 的轻量评论系统，适合接入 Astro、Hexo、Hugo、VuePress 或普通静态站点。

## Highlights

- 提供公开评论接口：读取评论、提交评论、评论回复和按页面路径隔离评论数据。
- 使用 Cloudflare D1 持久化评论，包含初始化 schema 和后续 migration。
- 使用 Cloudflare Turnstile 做服务端人机验证，本地开发环境支持更顺滑的调试流程。
- 提供基于 `ADMIN_TOKEN` 的管理接口，可查询评论、按状态筛选、更新状态和永久删除评论。
- 提供静态后台管理页，支持保存管理 token、搜索、状态筛选、审核和删除评论。
- 提供普通 HTML 前端组件，包含评论列表、回复、表单、Turnstile 加载和基础样式。
- 提供可直接复制使用的 Astro 组件产物，方便接入 Astro / Mizuki 站点。
- 提供一键后端部署脚本，可处理 Cloudflare 登录检查、D1 创建、migration、Worker secrets、Turnstile widget 和前端产物生成。
- 提供 plain HTML、Astro / Mizuki、Hexo、Hugo 等接入示例和部署文档。

## Included APIs

```text
GET    /api/comments?path=/xxx
POST   /api/comments
GET    /api/admin/comments?status=approved
PATCH  /api/admin/comments/:id/status
DELETE /api/admin/comments/:id
```

## Release Assets

推荐随源码一起使用这些目录中的产物和示例：

- `frontend/vanilla/comments.js`
- `frontend/vanilla/comments.css`
- `frontend/astro/YuuComments.astro`
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `examples/`
- `docs/`

部署脚本运行后还会生成可直接发布的 `dist/frontend/` 和 `dist/astro/` 产物。

## Quick Start

```bash
pnpm install
pnpm setup
pnpm deploy:backend
```

部署完成后，将 `dist/frontend/` 中的文件发布到站点的 `/comments/` 目录，并在页面中加入：

```html
<div id="yuucomments" data-page-key="/posts/example/"></div>
<link rel="stylesheet" href="/comments/comments.css" />
<script src="/comments/yuucomments.config.js"></script>
<script src="/comments/comments.js" defer></script>
```

Astro 项目可以复制 `dist/astro/YuuComments.astro` 后这样使用：

```astro
---
import YuuComments from "../components/YuuComments.astro";
---

<YuuComments pageKey={Astro.url.pathname} />
```

## Before Deploying

- 在正式环境配置 `TURNSTILE_SECRET_KEY`。
- 妥善保存 `ADMIN_TOKEN`，不要公开或提交。
- 将真实前端域名加入 `worker/src/utils/cors.ts` 的 CORS 白名单。
- 如果使用自动创建 Turnstile widget，需要准备具备 `Account -> Turnstile -> Edit` 权限的 Cloudflare API token。
- 发布前建议运行 `pnpm typecheck`。

## Verification

本次发布前已检查：

- `package.json` 版本号为 `0.1.0`。
- 当前仓库没有已有 release tag。
- `pnpm typecheck` 通过。
- 已修复两处 Worker 405 响应中的中文乱码文案。

## Notes

这是首个公开版本，默认评论提交后状态为 `approved`，评论会立即展示。后续如果需要完整审核流，可以将默认状态调整为 `pending`，并同步前端提示文案。
