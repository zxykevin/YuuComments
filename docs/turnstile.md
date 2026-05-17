# Turnstile

YuuComments 需要两类 Turnstile key：

- `PUBLIC_TURNSTILE_SITE_KEY`：前端公开使用
- `TURNSTILE_SECRET_KEY`：Worker 服务端校验使用

部署脚本会优先读取环境变量、本地 `secrets.production.json`，如果提供了 `CLOUDFLARE_API_TOKEN`，还会尝试从 Cloudflare API 自动读取。仍然无法确定时，脚本会在终端提示输入。
