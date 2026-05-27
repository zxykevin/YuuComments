# Security

- 不要提交真实的 `worker/wrangler.toml`
- 不要提交 `secrets.production.json`
- `ADMIN_TOKEN` 只应保存在本地安全位置或 Worker secret 中
- `TURNSTILE_SECRET_KEY` 是私密 key，只能作为 Worker secret 保存
- `PUBLIC_TURNSTILE_SITE_KEY` 是公开 key，可以放前端
- `CLOUDFLARE_API_TOKEN` 只用于部署，不能提交到 GitHub
- `dist/frontend/yuucomments.config.js` 只能写入公开的 Worker API 地址和 Turnstile Site Key
- 上线前请确认 `worker/src/utils/cors.ts` 中的白名单域名已经替换为真实站点域名
- v0.1.3 的点赞功能使用匿名 `visitor_hash` 限制重复点赞，不需要登录
- `visitor_hash` 由请求 IP 和 User-Agent 计算得到，`comment_likes` 表不保存原始 IP 或原始 User-Agent
- 点赞不是强身份系统，换设备、换浏览器或换网络可能被视为不同访问者
