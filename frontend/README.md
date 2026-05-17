# Frontend

这里存放 YuuComments 的前端接入资产。

- `vanilla/comments.js`
- `vanilla/comments.css`
- `astro/CommentBox.astro`

普通 HTML 可直接使用 `vanilla/` 版本；Astro 项目可以使用组件封装。

部署脚本会生成：

- `dist/frontend/comments.js`
- `dist/frontend/comments.css`
- `dist/frontend/yuucomments.config.js`

配置读取优先级：

1. HTML `data-api-base` / `data-site-key`
2. `window.YuuCommentsConfig.apiBase` / `window.YuuCommentsConfig.turnstileSiteKey`
3. 都没有时，评论区显示明确的配置缺失提示

`yuucomments.config.js` 只允许包含公开的 Worker API 地址和 Turnstile Site Key。
