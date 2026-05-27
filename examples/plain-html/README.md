# Plain HTML

最小可用示例见 `index.html`。

页面里只需要：

```html
<div id="yuucomments" data-page-key="/posts/example/"></div>

<link rel="stylesheet" href="/comments/comments.css" />
<script src="/comments/yuucomments.config.js"></script>
<script src="/comments/comments.js" defer></script>
```

部署完成后，将 `dist/frontend/` 里的三个文件发布到站点 `/comments/` 路径即可。

v0.1.3 起，评论组件会自动显示点赞按钮。新部署用户不需要额外配置；从旧版本升级的用户需要先执行 D1 migration：

```bash
pnpm db:migrate:remote
```

点赞不需要登录，基于匿名 `visitor_hash` 去重，不会存储原始 IP。

如果你更想把配置写在 HTML 上，仍可使用 `data-api-base` 和 `data-site-key`；它们的优先级高于 `window.YuuCommentsConfig`。

旧版 `id="yuulog-comments"` 仍然兼容，但新接入请优先使用 `id="yuucomments"`。
