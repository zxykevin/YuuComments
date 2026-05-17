# Cloudflare API Token

YuuComments 有两种 Cloudflare 认证方式，它们用途不同：

1. `wrangler login`
   - 负责登录 Wrangler
   - 足够完成 Worker 部署、D1 创建、migration 和 Worker secrets 上传
2. 环境变量 `CLOUDFLARE_API_TOKEN`
   - 只在脚本需要直接调用 Cloudflare REST API 时使用
   - 当前主要用于自动创建或读取 Turnstile widget

## 什么时候必须准备 `CLOUDFLARE_API_TOKEN`

如果 `secrets.production.json` 里已经有：

```json
{
  "PUBLIC_TURNSTILE_SITE_KEY": "...",
  "TURNSTILE_SECRET_KEY": "..."
}
```

那么正常部署只需要先运行：

```powershell
pnpm exec wrangler login
```

如果你希望部署脚本在缺少 Turnstile key 时自动创建一个名为 `YuuComments` 的 Turnstile widget，那么还需要提前准备：

```powershell
$env:CLOUDFLARE_API_TOKEN = "你的 Cloudflare API token"
```

这个 token 至少需要：

- `Account` -> `Turnstile` -> `Edit`

Cloudflare API 文档中，这项权限对应可以创建 Turnstile widget 的 `Turnstile Sites Write` / `Turnstile Edit` 能力。

## 如何创建这个 token

1. 打开 Cloudflare Dashboard
2. 进入 `My Profile`
3. 进入 `API Tokens`
4. 点击 `Create Custom Token`
5. 添加权限：
   - `Account`
   - `Turnstile`
   - `Edit`
6. 在 `Account Resources` 中选择：
   - `Include`
   - 你要部署 YuuComments 的账号
7. 创建 token 后复制一次，保存好

推荐把它只作为临时环境变量使用：

```powershell
$env:CLOUDFLARE_API_TOKEN = "你的 Cloudflare API token"
```

不要把这个 token 写进 Git，也不要提交到仓库。

## 自动创建 Turnstile 时还需要什么

Cloudflare 要求普通 Turnstile widget 至少绑定一个 hostname。部署脚本会自动附带：

- `127.0.0.1`
- `localhost`

你还需要提供自己的正式站点 hostname，例如：

```powershell
$env:TURNSTILE_HOSTNAMES = "example.com,www.example.com"
```

只写 hostname，不要写协议：

- 正确：`example.com`
- 错误：`https://example.com`

如果没有提前设置 `TURNSTILE_HOSTNAMES`，脚本会在首次创建 widget 时提示你输入。
