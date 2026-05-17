# Security

- 不要提交真实的 `worker/wrangler.toml`
- 不要提交 `secrets.production.json`
- `ADMIN_TOKEN` 只应保存在本地安全位置或 Worker secret 中
- `TURNSTILE_SECRET_KEY` 是私密 key，只能作为 Worker secret 保存
- `PUBLIC_TURNSTILE_SITE_KEY` 是公开 key，可以放前端
- `CLOUDFLARE_API_TOKEN` 只用于部署，不能提交到 GitHub
- `dist/frontend/yuucomments.config.js` 只能写入公开的 Worker API 地址和 Turnstile Site Key
- 上线前请确认 `worker/src/utils/cors.ts` 中的白名单域名已经替换为真实站点域名
