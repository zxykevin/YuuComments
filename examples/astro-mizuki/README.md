# Astro Mizuki

将 `frontend/vanilla/comments.js` 和 `frontend/vanilla/comments.css` 发布到站点的 `/comments/` 路径，然后在文章页中使用：

```astro
---
import CommentBox from "../../frontend/astro/CommentBox.astro";
---

<CommentBox
  pageKey={Astro.url.pathname}
  apiBase={import.meta.env.PUBLIC_COMMENTS_API_BASE_URL}
  siteKey={import.meta.env.PUBLIC_TURNSTILE_SITE_KEY}
/>
```

这份示例故意不依赖 Mizuki 的主题变量、Umami 或站点私有配置。

部署脚本还会在终端输出可直接填入 Astro / Mizuki 的环境变量：

```env
PUBLIC_COMMENTS_API_BASE_URL=<Worker API URL>
PUBLIC_TURNSTILE_SITE_KEY=<Turnstile Site Key>
```

Turnstile Site Key 是公开 key，可以放前端；Turnstile Secret Key 和 `ADMIN_TOKEN` 不能放进前端项目。
