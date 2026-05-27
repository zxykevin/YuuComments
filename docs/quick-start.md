# YuuComments 快速启动

# YuuComments Quick Start

这份文档介绍如何从零部署 YuuComments。
This guide explains how to deploy YuuComments from scratch.

YuuComments 现在的推荐入口是一个命令：`pnpm deploy:backend`。
The recommended entry point is now one command: `pnpm deploy:backend`.

README 只保留最短启动方式，详细步骤都放在这份文档里。
The README keeps only the shortest path, while the detailed steps live in this document.

## 1. 先理解运行逻辑

## 1. Understand The Runtime Flow

YuuComments 由 Worker API、D1 数据库、前端评论组件和静态后台四部分组成。
YuuComments has four parts: the Worker API, the D1 database, the frontend comment widget, and the static admin dashboard.

Worker API 负责评论读取、评论提交、后台查询和状态更新。
The Worker API handles comment reads, comment creation, admin listing, and moderation updates.

D1 负责保存评论数据。
D1 stores the comment data.

v0.1.3 起，D1 也保存匿名评论点赞记录。
Starting in v0.1.3, D1 also stores anonymous comment like records.

前端评论组件挂载在 `#yuucomments` 或兼容的 `#yuulog-comments` 元素上。
The frontend widget mounts on `#yuucomments` or the compatible `#yuulog-comments` element.

前端组件会读取 `window.YuuCommentsConfig` 里的 Worker 地址和 Turnstile site key。
The frontend widget reads the Worker URL and Turnstile site key from `window.YuuCommentsConfig`.

后台页面是静态文件，发布后通过 `ADMIN_TOKEN` 调用 Worker 管理接口。
The admin dashboard is static, and it calls the Worker admin API with `ADMIN_TOKEN` after being published.

## 2. 准备条件

## 2. Requirements

你需要一个 Cloudflare 账号。
You need a Cloudflare account.

你需要本机已经安装 Node.js、pnpm 和 Git。
You need Node.js, pnpm, and Git installed locally.

项目当前使用 `pnpm@11.0.9`。
This project currently uses `pnpm@11.0.9`.

如果你使用 Corepack，可以先启用它。
If you use Corepack, enable it first.

```powershell
corepack enable
```

你还需要提前登录 Cloudflare，或者在部署脚本提示时再登录。
You also need to log in to Cloudflare in advance, or do it when the deployment script asks.

```powershell
pnpm exec wrangler login
```

## 3. 进入项目目录

## 3. Enter The Project Directory

先克隆或下载本仓库。
Clone or download this repository first.

然后进入 YuuComments 项目目录。
Then enter the YuuComments project directory.

```powershell
cd path\to\yuulog-comments
```

如果你已经在项目目录里，可以跳过这一步。
If you are already in the project directory, you can skip this step.

## 4. 推荐方式：一键部署

## 4. Recommended Path: One-Command Deployment

运行下面这个命令即可开始完整部署流程。
Run the command below to start the full deployment flow.

```powershell
pnpm deploy:backend
```

这个命令会自动安装依赖。
This command installs dependencies automatically.

这个命令会检查 Cloudflare 登录状态。
This command checks the Cloudflare login state.

这个命令会在缺少 `worker/wrangler.toml` 时从 `worker/wrangler.toml.example` 生成配置文件。
This command creates `worker/wrangler.toml` from `worker/wrangler.toml.example` when the config file is missing.

这个命令会查找名为 `yuucomments-db` 的 D1 数据库。
This command looks for the D1 database named `yuucomments-db`.

如果 D1 数据库不存在，脚本会自动创建它。
If the D1 database does not exist, the script creates it automatically.

如果 `database_id` 不一致，脚本会把真实 ID 写回 `worker/wrangler.toml`。
If `database_id` does not match, the script writes the real ID back to `worker/wrangler.toml`.

这个命令会准备或复用 Turnstile 配置。
This command prepares or reuses the Turnstile configuration.

这个命令会生成或复用 `ADMIN_TOKEN`。
This command creates or reuses `ADMIN_TOKEN`.

这个命令会上传缺失的 Worker secrets。
This command uploads missing Worker secrets.

这个命令会运行 TypeScript 检查。
This command runs the TypeScript check.

这个命令会执行远程 D1 migration。
This command applies remote D1 migrations.

如果你是新部署用户，当前 migration 会创建评论表和点赞表，不需要手动修改 schema。
For new deployments, the current migrations create both the comments table and the likes table, so no manual schema edits are needed.

这个命令会部署 Cloudflare Worker。
This command deploys the Cloudflare Worker.

这个命令会生成 `dist/frontend/`、`dist/astro/` 和 `dist/admin/`。
This command generates `dist/frontend/`, `dist/astro/`, and `dist/admin/`.

## 5. Turnstile 配置方式

## 5. Turnstile Options

YuuComments 需要 Turnstile site key 和 Turnstile secret key。
YuuComments needs a Turnstile site key and a Turnstile secret key.

site key 会写入前端配置，可以公开。
The site key is written into frontend config and can be public.

secret key 会作为 Worker secret 使用，不能公开。
The secret key is used as a Worker secret and must stay private.

### 方式 A：让脚本自动创建 Turnstile

### Option A: Let The Script Create Turnstile

如果你想让脚本自动创建 Turnstile widget，请先设置 Cloudflare API token。
If you want the script to create the Turnstile widget automatically, set a Cloudflare API token first.

```powershell
$env:CLOUDFLARE_API_TOKEN = "your-cloudflare-api-token"
$env:TURNSTILE_HOSTNAMES = "example.com,www.example.com"
```

`CLOUDFLARE_API_TOKEN` 至少需要 `Account -> Turnstile -> Edit` 权限。
`CLOUDFLARE_API_TOKEN` needs at least the `Account -> Turnstile -> Edit` permission.

`TURNSTILE_HOSTNAMES` 只写 hostname，不要写 `https://`。
`TURNSTILE_HOSTNAMES` should contain hostnames only, without `https://`.

脚本会自动额外加入 `127.0.0.1` 和 `localhost`。
The script also adds `127.0.0.1` and `localhost` automatically.

如果你没有提前设置 `TURNSTILE_HOSTNAMES`，脚本会在运行时询问。
If you do not set `TURNSTILE_HOSTNAMES` in advance, the script asks for it at runtime.

### 方式 B：使用已有 Turnstile key

### Option B: Use Existing Turnstile Keys

如果你已经有 Turnstile key，可以创建 `secrets.production.json`。
If you already have Turnstile keys, create `secrets.production.json`.

```json
{
  "PUBLIC_TURNSTILE_SITE_KEY": "your-turnstile-site-key",
  "TURNSTILE_SECRET_KEY": "your-turnstile-secret-key",
  "TURNSTILE_HOSTNAMES": ["example.com", "www.example.com"]
}
```

`secrets.production.json` 已经被 `.gitignore` 忽略。
`secrets.production.json` is already ignored by `.gitignore`.

不要把这个文件提交到 Git。
Do not commit this file to Git.

### 方式 C：运行时输入

### Option C: Enter Values At Runtime

你也可以什么都不提前写，直接运行 `pnpm deploy:backend`。
You can also write nothing in advance and run `pnpm deploy:backend` directly.

脚本会在需要时提示你输入 Cloudflare API token、hostname 或 Turnstile key。
The script prompts you for the Cloudflare API token, hostnames, or Turnstile keys when needed.

## 6. 部署成功后你会得到什么

## 6. What You Get After Deployment

部署成功后，终端会输出 Worker API URL。
After deployment succeeds, the terminal prints the Worker API URL.

部署成功后，终端会输出 `PUBLIC_TURNSTILE_SITE_KEY`。
After deployment succeeds, the terminal prints `PUBLIC_TURNSTILE_SITE_KEY`.

部署成功后，终端会输出 `ADMIN_TOKEN`，或者提示它已经远程配置。
After deployment succeeds, the terminal prints `ADMIN_TOKEN`, or says it is already configured remotely.

部署成功后，脚本会生成前端评论组件文件。
After deployment succeeds, the script generates frontend widget files.

```text
dist/frontend/comments.js
dist/frontend/comments.css
dist/frontend/yuucomments.config.js
```

部署成功后，脚本会生成普通直嵌和 iframe 两个 Astro 组件。
After deployment succeeds, the script generates both inline and iframe Astro components.

```text
dist/astro/YuuComments.astro
dist/astro/YuuCommentsIframe.astro
```

部署成功后，脚本会生成后台静态文件。
After deployment succeeds, the script generates admin static files.

```text
dist/admin/index.html
dist/admin/admin.js
dist/admin/admin.css
```

## 7. 接入普通 HTML 网站

## 7. Use With Plain HTML

把 `dist/frontend/` 里的三个文件发布到你网站的 `/comments/` 目录。
Publish the three files in `dist/frontend/` to your site's `/comments/` directory.

在需要显示评论区的页面插入下面这段代码。
Add the snippet below to the page where comments should appear.

```html
<div id="yuucomments" data-page-key="/posts/example/"></div>
<link rel="stylesheet" href="/comments/comments.css" />
<script src="/comments/yuucomments.config.js"></script>
<script src="/comments/comments.js" defer></script>
```

`data-page-key` 用来区分不同页面的评论。
`data-page-key` separates comments for different pages.

如果不写 `data-page-key`，前端会使用当前页面路径。
If `data-page-key` is omitted, the frontend uses the current page path.

## 8. 接入 Astro

## 8. Use With Astro

把 `dist/astro/YuuComments.astro` 或 `dist/astro/YuuCommentsIframe.astro` 复制到你的 Astro 项目组件目录。
Copy `dist/astro/YuuComments.astro` or `dist/astro/YuuCommentsIframe.astro` into your Astro project's component directory.

在文章页面中引入组件。
Import the component in your post page.

```astro
---
import YuuComments from "../components/YuuComments.astro";
---

<YuuComments pageKey={Astro.url.pathname} />
```

如果需要 iframe 隔离页面 CSS，可以改用 iframe 组件。
If you need iframe isolation from page CSS, use the iframe component instead.

```astro
---
import YuuCommentsIframe from "../components/YuuCommentsIframe.astro";
---

<YuuCommentsIframe pageKey={Astro.url.pathname} />
```

脚本也会在终端输出 Mizuki / Astro 可用的环境变量。
The script also prints environment variables for Mizuki / Astro.

```env
PUBLIC_COMMENTS_API_BASE_URL=<Worker API URL>
PUBLIC_TURNSTILE_SITE_KEY=<Turnstile Site Key>
```

如果你的 Astro 项目使用自己的评论组件，可以直接使用这两个环境变量。
If your Astro project uses its own comment component, you can use these two environment variables directly.

## 9. 发布管理后台

## 9. Publish The Admin Dashboard

把 `dist/admin/` 里的文件发布到你网站的 `/admin/` 目录。
Publish the files in `dist/admin/` to your site's `/admin/` directory.

打开后台页面后，输入 `ADMIN_TOKEN`。
After opening the admin page, enter `ADMIN_TOKEN`.

后台会把 token 保存在浏览器 localStorage 中。
The dashboard stores the token in browser localStorage.

你可以在后台查看评论、搜索评论、切换状态和删除评论。
You can view comments, search comments, change statuses, and delete comments in the dashboard.

## 10. 后端接口

## 10. Backend API

前端读取评论时会调用 `GET /api/comments?path=/xxx`。
The frontend calls `GET /api/comments?path=/xxx` to read comments.

这个接口会为每条评论返回 `likeCount` 和 `liked`。
This endpoint returns `likeCount` and `liked` for each comment.

前端提交评论时会调用 `POST /api/comments`。
The frontend calls `POST /api/comments` to create comments.

前端点赞时会调用 `POST /api/comments/:id/like`。
The frontend calls `POST /api/comments/:id/like` to like a comment.

前端取消点赞时会调用 `DELETE /api/comments/:id/like`。
The frontend calls `DELETE /api/comments/:id/like` to unlike a comment.

后台读取评论时会调用 `GET /api/admin/comments`。
The dashboard calls `GET /api/admin/comments` to list comments.

后台列表也会返回并展示 `likeCount`，但不会修改点赞数。
The dashboard also returns and displays `likeCount`, but it does not modify likes.

后台修改状态时会调用 `PATCH /api/admin/comments/:id/status`。
The dashboard calls `PATCH /api/admin/comments/:id/status` to update moderation status.

后台删除评论时会调用 `DELETE /api/admin/comments/:id`。
The dashboard calls `DELETE /api/admin/comments/:id` to delete a comment.

管理接口需要 `Authorization: Bearer <ADMIN_TOKEN>`。
Admin endpoints require `Authorization: Bearer <ADMIN_TOKEN>`.

点赞接口不需要登录。YuuComments 使用匿名 `visitor_hash` 限制同一访问者对同一条评论只能点赞一次。`visitor_hash` 由请求 IP 和 User-Agent 计算得到，系统不会在点赞表中保存原始 IP 或原始 User-Agent。
Like endpoints do not require login. YuuComments uses an anonymous `visitor_hash` to limit one like per visitor and comment. The `visitor_hash` is derived from the request IP and User-Agent, and raw IP addresses or raw User-Agent values are not stored in the likes table.

这不是强身份系统。换设备、换浏览器或换网络可能被视为不同访问者。
This is not a strong identity system. Changing devices, browsers, or networks may be treated as a different visitor.

## 11. CORS 和域名

## 11. CORS And Domains

部署脚本会根据 `TURNSTILE_HOSTNAMES` 尝试把站点域名加入 `worker/src/utils/cors.ts`。
The deployment script tries to add site domains to `worker/src/utils/cors.ts` based on `TURNSTILE_HOSTNAMES`.

如果你后续更换前端域名，请重新运行部署脚本。
If you change the frontend domain later, run the deployment script again.

```powershell
pnpm deploy:backend
```

如果浏览器提示 CORS 错误，请检查 `worker/src/utils/cors.ts` 是否包含真实前端域名。
If the browser reports a CORS error, check whether `worker/src/utils/cors.ts` contains the real frontend domain.

域名应该包含协议，例如 `https://example.com`。
The domain should include the protocol, such as `https://example.com`.

## 12. 本地开发

## 12. Local Development

如果你只想本地开发 Worker，可以先准备本地数据库。
If you only want to develop the Worker locally, prepare the local database first.

```powershell
pnpm db:migrate:local
```

然后启动 Wrangler dev。
Then start Wrangler dev.

```powershell
pnpm dev
```

默认本地地址通常是 `http://localhost:8787`。
The default local URL is usually `http://localhost:8787`.

本地开发时，Worker 会允许 localhost 场景下跳过 Turnstile 校验。
During local development, the Worker allows localhost to bypass Turnstile verification.

正式环境不会跳过 Turnstile。
Production does not bypass Turnstile.

## 13. 更新和重新部署

## 13. Update And Redeploy

以后修改 Worker、前端组件、后台或 migration 后，优先重新运行一键部署命令。
After changing the Worker, frontend widget, dashboard, or migrations later, prefer running the one-command deployment again.

```powershell
pnpm deploy:backend
```

不要把 `pnpm deploy` 和 `pnpm deploy:backend` 混用。
Do not treat `pnpm deploy` and `pnpm deploy:backend` as the same command.

`pnpm deploy` 只是普通 Wrangler 部署。
`pnpm deploy` is only a normal Wrangler deploy.

`pnpm deploy:backend` 才会处理依赖、D1、secrets、migration、Worker、前端文件和后台文件。
`pnpm deploy:backend` handles dependencies, D1, secrets, migrations, the Worker, frontend files, and admin files.

### 从旧版本升级到 v0.1.3

### Upgrade From An Older Version To v0.1.3

v0.1.3 新增评论点赞功能，并新增 `comment_likes` D1 表。
v0.1.3 adds comment likes and the new `comment_likes` D1 table.

如果你使用一键部署脚本，它会执行远程 migration。
If you use the one-command deployment script, it applies remote migrations.

```powershell
pnpm deploy:backend
```

如果你只想单独执行数据库升级，请运行：
If you only want to apply the database upgrade, run:

```powershell
pnpm db:migrate:remote
```

本地开发数据库使用：
For the local development database:

```powershell
pnpm db:migrate:local
```

如果没有执行这次 migration，评论列表或后台可能会提示点赞数据表不存在。
If this migration has not been applied, the comment list or dashboard may report that the likes table is missing.

## 14. 常见问题

## 14. Troubleshooting

### 评论区显示配置缺失

### The Comment Widget Says Config Is Missing

请检查 `dist/frontend/yuucomments.config.js` 是否已经发布。
Check whether `dist/frontend/yuucomments.config.js` has been published.

请检查页面是否先加载 `yuucomments.config.js`，再加载 `comments.js`。
Check whether the page loads `yuucomments.config.js` before `comments.js`.

请检查配置里是否包含 `apiBase` 和 `turnstileSiteKey`。
Check whether the config contains `apiBase` and `turnstileSiteKey`.

### 评论加载失败

### Comments Fail To Load

请检查 Worker API URL 是否正确。
Check whether the Worker API URL is correct.

请检查浏览器控制台是否有 CORS 报错。
Check whether the browser console shows a CORS error.

请检查当前页面路径是否和 `data-page-key` 一致。
Check whether the current page path matches `data-page-key`.

如果升级到 v0.1.3 后评论或后台加载失败，并看到 `comment_likes` 相关错误，请先执行 D1 migration。
If comments or the dashboard fail to load after upgrading to v0.1.3 and you see a `comment_likes` error, apply the D1 migration first.

### 评论提交失败

### Comment Submission Fails

请检查 Turnstile 是否正常显示并完成验证。
Check whether Turnstile appears and completes verification.

请检查 `TURNSTILE_SECRET_KEY` 是否已经作为 Worker secret 上传。
Check whether `TURNSTILE_SECRET_KEY` has been uploaded as a Worker secret.

请确认前端使用的是 site key，后端使用的是 secret key。
Make sure the frontend uses the site key and the backend uses the secret key.

### 后台无法登录

### Admin Login Fails

请确认输入的是部署脚本输出的 `ADMIN_TOKEN`。
Make sure you entered the `ADMIN_TOKEN` printed by the deployment script.

如果脚本提示 token 已经远程配置但本地不可见，请使用你之前保存的 token。
If the script says the token is already configured remotely but unavailable locally, use the token you saved earlier.

如果忘记 token，可以在 Cloudflare Worker secrets 中重新设置 `ADMIN_TOKEN` 后再部署。
If you forgot the token, reset `ADMIN_TOKEN` in Cloudflare Worker secrets and redeploy.

### 重新部署后数据库是否会丢失

### Will Redeploying Delete The Database

正常重新运行 `pnpm deploy:backend` 不会删除 D1 数据库。
Normally, rerunning `pnpm deploy:backend` does not delete the D1 database.

脚本会优先复用名为 `yuucomments-db` 的现有数据库。
The script prefers reusing the existing database named `yuucomments-db`.

不要手动删除 D1 数据库，除非你已经备份评论数据。
Do not manually delete the D1 database unless you have backed up comment data.

## 15. 最小检查清单

## 15. Minimal Checklist

- [ ] 已登录 Cloudflare。
- [ ] Cloudflare login is ready.
- [ ] 已运行 `pnpm deploy:backend`。
- [ ] `pnpm deploy:backend` has been run.
- [ ] 已保存 `ADMIN_TOKEN`。
- [ ] `ADMIN_TOKEN` has been saved.
- [ ] 已发布 `dist/frontend/` 到 `/comments/`。
- [ ] `dist/frontend/` has been published to `/comments/`.
- [ ] 已在页面插入评论区代码。
- [ ] The comment snippet has been added to the page.
- [ ] 如需后台，已发布 `dist/admin/` 到 `/admin/`。
- [ ] If the dashboard is needed, `dist/admin/` has been published to `/admin/`.
- [ ] 评论区可以加载。
- [ ] The comment widget loads.
- [ ] Turnstile 可以显示。
- [ ] Turnstile appears.
- [ ] 评论可以提交。
- [ ] Comments can be submitted.
- [ ] 后台可以用 `ADMIN_TOKEN` 访问。
- [ ] The dashboard can be accessed with `ADMIN_TOKEN`.
