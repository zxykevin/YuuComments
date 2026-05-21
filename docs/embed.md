# Iframe Embed

YuuComments keeps the normal inline integration unchanged. Use the iframe embed when your page theme, CSS, or script order makes an isolated comment frame easier to deploy.

## Usage

Publish the generated `dist/frontend/` files to your site's `/comments/` directory, then add this snippet to any page:

```html
<div
  id="yuucomments-iframe"
  data-page-key="/posts/example/"
  data-src="/comments/embed.html"
></div>
<script src="/comments/yuucomments-embed.js" defer></script>
```

The loader creates an iframe, passes `pageKey` to `embed.html`, and automatically resizes the iframe when the comment UI height changes.

## Stable pageKey

`data-page-key` must be stable for the lifetime of the page. It is the lookup key for comments, so changing it later will make existing comments appear under a different page.

Good examples:

```html
data-page-key="/posts/example/"
data-page-key="post:example-slug"
```

Avoid keys that include tracking parameters, temporary preview URLs, or values that change when the page title changes.

## Deployment Path

The iframe files are designed to live on the same website as the page, usually in `/comments/`:

- `/comments/embed.html`
- `/comments/embed-resize.js`
- `/comments/yuucomments-embed.js`
- `/comments/comments.js`
- `/comments/comments.css`
- `/comments/yuucomments.config.js`

Keeping the iframe on your own site makes browser privacy rules, asset paths, and Turnstile behavior easier to reason about.

## Turnstile Hostname Notes

Cloudflare Turnstile validates the hostname that renders the widget. For iframe embed, make sure your Turnstile widget allows the hostname where `/comments/embed.html` is served. If you serve the iframe from the same site as the article, this is usually the article site's hostname.

If you use a separate subdomain for comments, add that subdomain to the Turnstile widget hostnames too.
