# Hugo

预留目录，用于后续补充 Hugo 接入示例。

v0.1.3 起，YuuComments 前端组件内置评论点赞按钮。Hugo 站点接入时仍然只需要发布 `/comments/` 静态资源并插入评论容器。

从旧版本升级的用户需要先执行 D1 migration：

```bash
pnpm db:migrate:remote
```

点赞基于匿名 `visitor_hash`，不需要登录，也不会存储原始 IP。
