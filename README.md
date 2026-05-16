# yuulog-comments

一个基于 Cloudflare Workers、TypeScript 和 D1 的轻量评论后端，当前实现最小可用版本：

- `GET /api/comments?path=/xxx`
- `POST /api/comments`
- D1 持久化
- Turnstile 服务端校验预留
- 仅返回 JSON

## 安装依赖

```bash
npm install
```

## 创建 D1 数据库

```bash
npx wrangler d1 create yuulog-comments-db
```

创建完成后，把命令返回的 `database_id` 写入 `wrangler.toml` 的 `database_id`。

## 执行 migration

本地数据库：

```bash
npm run db:migrate:local
```

远程数据库：

```bash
npm run db:migrate:remote
```

## 配置 Turnstile secret

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

如果没有设置 `TURNSTILE_SECRET_KEY`，代码会在开发阶段跳过 Turnstile 校验，方便本地联调。正式环境必须配置该 secret。

## 本地开发

```bash
npm run dev
```

默认开发地址通常是 `http://localhost:8787`。

## 部署

```bash
npm run deploy
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
  "status": "pending",
  "message": "评论已提交，等待审核"
}
```

## Astro 前端接入示例

假设 Worker 已部署到 `https://comments.yuulog.org`，在 `G:\zxykevin\Documents\Mizuki` 里的 Astro 页面中可以这样调用：

```ts
const apiBase = "https://comments.yuulog.org";
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

- `parent_id` 已预留回复评论能力
- `status` 已预留审核流
- `email_hash` 和 `ip_hash` 只保存 SHA-256，不保存原文
- 当前索引已覆盖按页面、状态、时间读取评论，以及后续按父评论查询
