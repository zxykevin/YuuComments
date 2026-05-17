# yuulog-comments

一个基于 Cloudflare Workers、TypeScript 和 D1 的轻量评论后端，当前提供：

- `GET /api/comments?path=/xxx`
- `POST /api/comments`
- `GET /api/admin/comments?status=approved`
- `PATCH /api/admin/comments/:id/status`
- D1 持久化
- Turnstile 服务端校验
- 基于 `ADMIN_TOKEN` 的简易管理接口

## 首次部署只需三步

### 1. 登录 Cloudflare

```bash
pnpm exec wrangler login
```

### 2. 准备 Turnstile secret

任选一种方式：

```bash
$env:TURNSTILE_SECRET_KEY = "your-turnstile-secret"
```

或把真实值写入本地 `secrets.production.json`：

```json
{
  "TURNSTILE_SECRET_KEY": "your-turnstile-secret"
}
```

也可以什么都不提前准备，部署脚本会在终端里提示输入。

### 3. 一键部署

```bash
pnpm deploy:backend
```

脚本会自动：

- 安装依赖
- 检查 Cloudflare 登录状态
- 创建远端 D1（若不存在）
- 回写 `wrangler.toml` 中的 `database_id`
- 自动生成 `ADMIN_TOKEN`
- 读取或提示输入 `TURNSTILE_SECRET_KEY`
- 上传缺失的 Worker secrets
- 执行远程 migration
- 部署 Worker

首次生成的 `ADMIN_TOKEN` 会保存在本地 `secrets.production.json`，该文件已加入 `.gitignore`，不要提交到仓库。

## 本地开发

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

默认开发地址通常是 `http://localhost:8787`。

如果没有设置 `TURNSTILE_SECRET_KEY`，代码会在开发环境跳过 Turnstile 校验，方便本地联调。正式环境必须配置该 secret。

## 常用命令

```bash
pnpm typecheck
pnpm db:migrate:remote
pnpm deploy
pnpm deploy:backend
```

## API

### 获取评论

```http
GET /api/comments?path=/posts/example/
```

响应：

```json
{
  "ok": true,
  "comments": []
}
```

前台接口只返回 `status = "approved"` 的评论。

### 提交评论

```http
POST /api/comments
Content-Type: application/json
```

```json
{
  "pagePath": "/posts/example/",
  "parentId": null,
  "nickname": "Kevin",
  "email": "test@example.com",
  "website": "https://example.com",
  "content": "评论内容",
  "turnstileToken": "xxx"
}
```

响应：

```json
{
  "ok": true,
  "status": "approved",
  "message": "评论已提交，等待审核"
}
```

默认提交状态当前为 `approved`，可在代码中切换为 `pending`。

### 管理评论

```http
GET /api/admin/comments?status=approved
Authorization: Bearer <ADMIN_TOKEN>
```

```http
PATCH /api/admin/comments/:id/status
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

```json
{
  "status": "approved"
}
```

支持的状态：

- `pending`
- `approved`
- `spam`
- `deleted`

## Astro 前端接入示例

假设 Worker 已部署到 `https://comments.example.com`：

```ts
const apiBase = "https://comments.example.com";
const pagePath = window.location.pathname;

const commentsResponse = await fetch(
  `${apiBase}/api/comments?path=${encodeURIComponent(pagePath)}`,
);
const comments = await commentsResponse.json();
```

提交评论：

```ts
await fetch(`${apiBase}/api/comments`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    pagePath: window.location.pathname,
    parentId: null,
    nickname,
    email,
    website,
    content,
    turnstileToken,
  }),
});
```

## 设计说明

- `parent_id` 用于回复评论
- `status` 支持审核流
- 前台接口只返回 `email_hash`
- 管理接口可读取原始 `email`
- `ip_hash` 只保存 SHA-256，不保存原文
- 当前索引覆盖按页面、状态、时间读取评论，以及按父评论查询
