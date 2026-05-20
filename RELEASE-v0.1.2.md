# YuuComments v0.1.2

> This is an urgent deployment bugfix release.  
> 这是一个紧急部署问题修复版本。

## Fixes / 修复内容

- Fixed Worker API URL detection in `scripts/deploy-backend.ts`.  
  修复了 `scripts/deploy-backend.ts` 中 Worker API URL 的识别逻辑。
- The deploy script now only accepts deployed Worker URLs ending in `.workers.dev` when generating frontend and admin bundles.  
  现在部署脚本在生成前端和管理后台 bundle 时，只会接受以 `.workers.dev` 结尾的已部署 Worker URL。
- This prevents Wrangler informational links, such as telemetry documentation URLs, from being written into `dist/frontend/yuucomments.config.js` as `apiBase`.  
  这可以防止 Wrangler 输出的信息链接，例如 telemetry 文档链接，被错误写入 `dist/frontend/yuucomments.config.js` 并作为 `apiBase` 使用。

## Impact / 影响

Before this release, `pnpm deploy:backend` could generate a broken frontend config when Wrangler printed a documentation URL before the deployed Worker URL. Static site demos using the generated `/comments/yuucomments.config.js` would then show comment load and submit failures even though Turnstile succeeded.

在此版本之前，如果 Wrangler 在真正的 Worker URL 之前先输出了文档链接，`pnpm deploy:backend` 可能会生成错误的前端配置。使用生成的 `/comments/yuucomments.config.js` 的静态站点 Demo 可能会出现评论加载失败、提交失败的问题，即使 Turnstile 人机验证已经成功通过。

After this release, generated frontend bundles point at the actual Worker API URL.

此版本发布后，生成的前端 bundle 会正确指向实际部署的 Worker API URL。

## Verification / 验证

Checked before release:

发布前已完成以下检查：

- `pnpm typecheck` passed.  
  `pnpm typecheck` 已通过。
- Real Worker API request returned `{"ok":true,"comments":[]}`.  
  真实 Worker API 请求返回了 `{"ok":true,"comments":[]}`。
- A generated frontend config was verified to contain the deployed Worker URL instead of a Wrangler documentation URL.  
  已确认生成的前端配置中包含的是实际部署的 Worker URL，而不是 Wrangler 文档链接。
