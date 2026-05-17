# YuuComments

YuuComments 是一个基于 Cloudflare Workers、D1 和 Turnstile 的轻量评论系统。它不需要服务器，不依赖 GitHub 登录，适合 Astro、Hexo、Hugo、VuePress、普通静态网站等场景。后端可通过脚本自动部署，前端复制一段 HTML 即可接入。

## 目录

- `worker/`：Worker 源码、D1 schema、迁移和部署入口
- `frontend/`：前端接入资产
- `admin/`：后台管理相关资产
- `examples/`：不同站点生成器的接入示例
- `docs/`：部署与安全文档

## 当前能力

- `GET /api/comments?path=/xxx`
- `POST /api/comments`
- `GET /api/admin/comments?status=approved`
- `PATCH /api/admin/comments/:id/status`
- D1 持久化
- Turnstile 服务端校验
- 基于 `ADMIN_TOKEN` 的管理接口

## 快速开始

### 第一步：在 YuuComments 文件夹中打开终端

先下载或克隆本项目，然后进入 `YuuComments` 项目文件夹。

Windows 用户可以直接在项目文件夹空白处右键，选择“在终端中打开”。

如果你使用命令行，也可以这样进入：

```bash
cd path/to/YuuComments
```

### 第二步：安装依赖

在终端中输入：

```bash
pnpm install
```

### 第三步：生成本地配置文件

在终端中输入：

```bash
pnpm setup
```

首次运行后，会根据 `worker/wrangler.toml.example` 自动生成本地 `worker/wrangler.toml`。真实配置文件已加入 `.gitignore`，不会提交到仓库。

### 第四步：登录 Cloudflare

如果你还没有登录过 Cloudflare，在终端中输入：

```bash
pnpm exec wrangler login
```

浏览器会自动打开授权页面，按提示登录即可。

### 第五步：准备 Turnstile

部署脚本需要 Turnstile Site Key 和 Secret Key。

你可以任选一种方式：

1. 先把 key 写入本地 `secrets.production.json`
2. 设置环境变量
3. 什么都不提前写，等脚本运行时在终端里按提示输入

示例：

```json
{
  "PUBLIC_TURNSTILE_SITE_KEY": "your-turnstile-site-key",
  "TURNSTILE_SECRET_KEY": "your-turnstile-secret-key"
}
```

### 第六步：开始一键部署

在终端中输入：

```bash
pnpm deploy:backend
```

如果脚本提示你输入 Turnstile key，就按提示粘贴进去。

### 第七步：保存部署结果

部署完成后，终端会输出：

- Worker API 地址
- `PUBLIC_TURNSTILE_SITE_KEY`
- `ADMIN_TOKEN`
- 普通 HTML 的最简接入代码
- Astro / Mizuki 可用的环境变量

其中 `ADMIN_TOKEN` 是私密值，请只自己保存，不要公开。

### 第八步：发布前端文件

部署完成后，脚本会自动生成：

- `dist/frontend/comments.js`
- `dist/frontend/comments.css`
- `dist/frontend/yuucomments.config.js`

把这三个文件发布到你自己网站的 `/comments/` 目录。

然后在需要显示评论区的页面中加入：

```html
<div id="yuucomments" data-page-key="/posts/example/"></div>
<link rel="stylesheet" href="/comments/comments.css" />
<script src="/comments/yuucomments.config.js"></script>
<script src="/comments/comments.js" defer></script>
```

这样就可以开始使用了。

部署脚本会自动：

- 检查 Cloudflare 登录状态
- 创建远端 D1（若不存在）
- 回写 `worker/wrangler.toml` 中的 `database_id`
- 自动生成或复用 `ADMIN_TOKEN`
- 自动读取、提示输入或尽量远程发现 Turnstile key
- 上传缺失的 Worker secrets
- 执行远程 migration
- 部署 Worker
- 输出 Worker API 地址、`PUBLIC_TURNSTILE_SITE_KEY` 和 `ADMIN_TOKEN`
- 生成可直接发布的 `dist/frontend/`

## 本地开发

```bash
pnpm install
pnpm setup
pnpm db:migrate:local
pnpm dev
```

## 文档

- [快速开始](docs/quick-start.md)
- [Cloudflare API Token](docs/cloudflare-api-token.md)
- [Turnstile](docs/turnstile.md)
- [安全说明](docs/security.md)

## 前端接入

普通 HTML：

```html
<div
  id="yuucomments"
  data-page-key="/posts/example/"
></div>

<link rel="stylesheet" href="/comments/comments.css" />
<script src="/comments/yuucomments.config.js"></script>
<script src="/comments/comments.js" defer></script>
```

部署完成后，把 `dist/frontend/` 里的三个文件发布到站点 `/comments/` 目录即可。`yuucomments.config.js` 只包含公开的 Worker API 地址和 Turnstile Site Key。

旧版 `id="yuulog-comments"` 仍然兼容，但新接入请优先使用 `id="yuucomments"`。

Astro：

```astro
---
import CommentBox from "../frontend/astro/CommentBox.astro";
---

<CommentBox
  pageKey={Astro.url.pathname}
  apiBase="https://your-worker.example.workers.dev"
  siteKey="your-turnstile-site-key"
/>
```

后台静态页在 `admin/`。部署前请在 `admin/index.html` 的 `<body data-api-base="">` 中填入 Worker 地址。

安全边界：

- Turnstile Site Key 是公开 key，可以放前端
- Turnstile Secret Key 只能作为 Worker secret 保存
- `ADMIN_TOKEN` 只能由站长自己保存
- `CLOUDFLARE_API_TOKEN` 只用于部署，不能提交到 GitHub
