# iframe 嵌入 / Iframe Embed

YuuComments 保留原有普通接入方式不变，也提供 iframe 嵌入方式。
YuuComments keeps the normal inline integration unchanged and also provides iframe embed mode.

当页面主题、全局 CSS 或脚本顺序容易影响评论区时，建议使用 iframe 嵌入。
Use iframe embed when the page theme, global CSS, or script order may interfere with the comment widget.

## 使用方法 / Usage

先把生成的 `dist/frontend/` 文件发布到你网站的 `/comments/` 目录。
First publish the generated `dist/frontend/` files to your site's `/comments/` directory.

然后在需要评论区的页面加入下面代码。
Then add the following snippet to the page where comments should appear.

```html
<div
  id="yuucomments-iframe"
  data-page-key="/posts/example/"
  data-src="/comments/embed.html"
  data-theme="dark"
  data-lang="zh-CN"
></div>
<script src="/comments/yuucomments-embed.js" defer></script>
```

`yuucomments-embed.js` 会创建 iframe，并把 `pageKey`、`theme`、`lang` 传给 `embed.html`。
`yuucomments-embed.js` creates the iframe and passes `pageKey`, `theme`, and `lang` to `embed.html`.

`embed-resize.js` 会监听 iframe 内评论区高度变化，并自动调整外层 iframe 高度。
`embed-resize.js` watches height changes inside the iframe and automatically resizes the outer iframe.

v0.1.3 起，iframe 内的评论组件也会显示点赞按钮，并使用相同的匿名点赞 API。
Starting in v0.1.3, the comment widget inside the iframe also shows like buttons and uses the same anonymous like APIs.

## 参数说明 / Options

`data-page-key` 是评论数据的页面键，必须长期稳定。
`data-page-key` is the page key for comment data and must stay stable over time.

`data-src` 是 iframe 内部页面地址，通常使用 `/comments/embed.html`。
`data-src` is the inner iframe page URL, usually `/comments/embed.html`.

`data-theme` 会传入 iframe，并设置评论区主题。
`data-theme` is passed into the iframe and sets the comment theme.

当前建议使用 `light` 或 `dark`。
The recommended values are currently `light` or `dark`.

`data-lang` 会传入 iframe，并设置评论区界面语言。
`data-lang` is passed into the iframe and sets the comment UI language.

当前支持 `zh-CN` 和 `en`，其他值会回退到中文。
The supported values are currently `zh-CN` and `en`; other values fall back to Chinese.

## 稳定的 pageKey / Stable pageKey

`data-page-key` 一旦改变，旧评论会显示在旧键下面，新键会被视为另一个页面。
If `data-page-key` changes, old comments remain under the old key and the new key is treated as another page.

推荐使用文章永久链接或稳定 slug。
Use a permalink or stable slug when possible.

```html
data-page-key="/posts/example/"
data-page-key="post:example-slug"
```

不要把统计参数、临时预览地址或会随标题变化的文本放进 `pageKey`。
Do not put tracking parameters, temporary preview URLs, or title-derived text that may change into `pageKey`.

## 部署路径 / Deployment Path

iframe 相关文件建议和你的网站一起部署，通常放在 `/comments/` 目录。
The iframe files should usually be deployed with your site under the `/comments/` directory.

- `/comments/embed.html`
- `/comments/embed-resize.js`
- `/comments/yuucomments-embed.js`
- `/comments/comments.js`
- `/comments/comments.css`
- `/comments/yuucomments.config.js`

把 iframe 文件放在自己网站下，可以让浏览器隐私规则、资源路径和 Turnstile 行为更容易预测。
Hosting the iframe files on your own site makes browser privacy rules, asset paths, and Turnstile behavior easier to predict.

## Turnstile 域名注意事项 / Turnstile Hostname Notes

Cloudflare Turnstile 会校验渲染组件的 hostname。
Cloudflare Turnstile validates the hostname that renders the widget.

使用 iframe 嵌入时，请确保 Turnstile widget 允许 `/comments/embed.html` 所在的 hostname。
When using iframe embed, make sure the Turnstile widget allows the hostname that serves `/comments/embed.html`.

如果 iframe 和文章页面在同一个网站下，通常只需要配置文章网站的 hostname。
If the iframe and article page are served from the same site, the article site's hostname is usually enough.

如果你用独立子域名托管评论文件，也需要把这个子域名加入 Turnstile hostnames。
If you host comment files on a separate subdomain, add that subdomain to the Turnstile hostnames too.

## 点赞功能 / Likes

点赞状态由 Worker 根据当前请求的匿名 `visitor_hash` 计算。
The like state is calculated by the Worker from the current request's anonymous `visitor_hash`.

如果你从旧版本升级，请先执行 v0.1.3 的 D1 migration，确保 `comment_likes` 表已经存在。
If you upgrade from an older version, apply the v0.1.3 D1 migration first so the `comment_likes` table exists.
