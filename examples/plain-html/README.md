# Plain HTML

```html
<div
  id="yuulog-comments"
  data-page-key="/posts/example/"
></div>

<link rel="stylesheet" href="/comments/comments.css" />
<script src="/comments/yuucomments.config.js"></script>
<script src="/comments/comments.js" defer></script>
```

部署完成后，将 `dist/frontend/` 里的三个文件发布到站点 `/comments/` 路径即可。

如果你更想把配置写在 HTML 上，仍可使用 `data-api-base` 和 `data-site-key`；它们的优先级高于 `window.YuuCommentsConfig`。
