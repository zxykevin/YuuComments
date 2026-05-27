# Frontend

这里存放 YuuComments 的前端接入资产。

- `vanilla/comments.js`
- `vanilla/comments.css`
- `astro/CommentBox.astro`
- `astro/YuuComments.astro`
- `astro/YuuCommentsIframe.astro`

普通 HTML 可直接使用 `vanilla/` 版本；Astro 项目可以使用组件封装。

部署脚本会生成：

- `dist/frontend/comments.js`
- `dist/frontend/comments.css`
- `dist/frontend/yuucomments.config.js`
- `dist/astro/YuuComments.astro`
- `dist/astro/YuuCommentsIframe.astro`

配置读取优先级：

1. HTML `data-api-base` / `data-site-key`
2. `window.YuuCommentsConfig.apiBase` / `window.YuuCommentsConfig.turnstileSiteKey`
3. 都没有时，评论区显示明确的配置缺失提示

`yuucomments.config.js` 只允许包含公开的 Worker API 地址和 Turnstile Site Key。

新接入推荐使用 `id="yuucomments"`；旧版 `id="yuulog-comments"` 仍然保留兼容。

`dist/astro/YuuComments.astro` 是可直接复制到任意 Astro 项目的最小普通直嵌组件版本。它默认使用 `Astro.url.pathname` 作为页面键，并读取 `/comments/yuucomments.config.js` 中的公开配置。

`dist/astro/YuuCommentsIframe.astro` 是 iframe 嵌入组件版本。它默认使用 `/comments/embed.html`，适合需要隔离页面 CSS 的 Astro / Mizuki 项目。
