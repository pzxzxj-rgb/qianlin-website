# 黔林旅行社网站

这是一个基于 Next.js、vinext、Cloudflare Workers 和本地 D1 的多租户旅行网站。当前包含正式租户 `qianlin-travel` 和演示租户 `yunnan-demo`。公开页面通过租户 slug 读取配置，后台通过服务端验证的 Session、用户成员关系和角色读取数据。

## 当前能力

后台包含公司资料、联系方式、网站图片、旅游线路、目的地和咨询管理。目的地管理不提供图片新增或修改，已有首页目的地图片继续保留。无图片目的地只能用于行程规划。后续如需更换目的地图片，应统一进入网站图片管理能力。

第三阶段 3G 已调整为通用咨询线索接收与 ERP 同步基础架构。咨询先保存到本地 D1，再创建同步任务。ERP Provider 默认是 `disabled`，也提供测试用 `mock` Provider。智旅目录仅保留接入边界说明，没有编造接口字段、地址、认证信息或真实调用逻辑。

建议游览时长目前仅作为参考资料，不参与自动行程计算。行程生成器按目的地区域和线路顺序整理。咨询管理仍不包含订单、支付、文件上传或真实 ERP 接入。

## 本地运行

```bash
npm ci
npm run db:reset:local
npm run dev
```

本地 D1 使用 `wrangler.local.jsonc` 和 `.wrangler/state`。本地重置命令只操作项目工作区内的本地数据库，不连接远程 D1。

## 质量检查

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run test:integration:local
npm audit --registry=https://registry.npmjs.org --omit=dev --audit-level=high
```

CI 使用 Node.js 22、npm 缓存和 `npm ci`。lint、typecheck、build、自动测试、本地 D1 与 HTTP 集成测试、生产依赖审计全部通过后才允许合并。

## 租户和后台安全边界

后台标准路径为 `/admin/t/:tenantSlug` 和 `/api/admin/t/:tenantSlug/...`，根路径保留给默认租户兼容入口。客户端提交的 tenant ID、tenant slug、provider、externalRecordId 和 syncStatus 都不会成为授权依据。资源查询和更新必须同时包含可信租户 ID 与资源 ID，跨租户资源统一按未找到或无权访问处理。

管理员身份模型包含 `users`、`tenant_memberships`、`sessions` 和 `admin_audit_logs`。Cookie 只保存不可预测的 Session token，数据库保存 token hash、用户、过期时间和撤销时间。密码修改会撤销该用户的旧 Session。owner 和 admin 的 MFA 接口已预留，但生产开放多租户前仍需接入并验证正式 MFA Provider。

咨询数据包含同意时间、政策版本、保留截止时间和匿名化时间字段。联系方式在后台列表中脱敏，完整联系方式需要已验证的管理员 Session。不要在日志、测试或 README 中写入真实密码、Token、手机号、邮箱或微信号。

## ERP Provider 边界

通用业务层只依赖 `ErpInquiryProvider`。可选 Provider 为 `disabled`、`mock` 和预留的 `zhilv`。ERP 配置必须来自服务端环境或租户集成配置，禁止把 API URL、Token、租户编号或用户名密码写入浏览器代码。

当前默认配置：

```text
ERP_PROVIDER=disabled
```

正式智旅 API 文档到达前，不执行真实智旅调用，不访问真实 ERP，也不提交真实密钥。

## Cloudflare 生产频率限制

应用层保留基础拒绝和测试保护。生产环境还必须在 Cloudflare WAF Rate Limiting 中配置规则，避免单个 Worker 实例的进程内计数被绕过。

管理员登录规则：

```text
http.request.uri.path eq "/api/admin/login" and http.request.method eq "POST"
```

失败登录计数表达式：

```text
http.request.uri.path eq "/api/admin/login" and http.request.method eq "POST" and http.response.code eq 401
```

建议按 Source IP 统计，初始阈值为 5 次/10 分钟，触发后阻断 15 分钟。

公开咨询规则：

```text
http.request.uri.path matches "^/api/t/[^/]+/inquiries$" and http.request.method eq "POST"
```

建议按 Source IP 统计，初始阈值为 5 次/10 分钟，触发后阻断 10 分钟。正式上线前应根据 Request rate analysis 调整阈值，并保留 Turnstile 和服务端字段验证作为第二层保护。

Cloudflare 控制台步骤仍需由项目管理员完成，包括匹配表达式、计数维度、阈值、阻断动作和正式域名 Host 条件。项目没有引入 KV 或 Durable Objects。

## 数据库迁移

迁移文件位于 `drizzle/`，当前最新迁移为 `0010_add_tenant_province_catalog.sql`。本任务不执行远程 D1 migration，不连接远程 D1，不部署生产环境。

## 尚未开放

当前未开放真实 ERP、MFA Provider、订单、支付、文件上传、WhatsApp、LINE、国际手机号、短信发送和邮件发送。咨询数据保留与匿名化任务需要在生产运维中配置定时执行，并在上线前完成人工审核。
