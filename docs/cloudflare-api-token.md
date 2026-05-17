# Cloudflare API Token

YuuComments 支持两种 Cloudflare 认证方式：

1. `wrangler login`
2. 环境变量 `CLOUDFLARE_API_TOKEN`

当提供 `CLOUDFLARE_API_TOKEN` 时，部署脚本会额外尝试读取 Turnstile widget 信息，用于自动发现 `PUBLIC_TURNSTILE_SITE_KEY`，并在可用时补齐 `TURNSTILE_SECRET_KEY`。

最少需要确保 token 有部署 Worker、管理 D1、读取 Turnstile widget 所需权限。
