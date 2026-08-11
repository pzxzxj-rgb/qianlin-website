# 黔林旅行社网站

这是一个基于 Next.js、vinext、Cloudflare Workers 和本地 D1 的多租户旅行网站。当前包含正式租户 `qianlin-travel` 和演示租户 `yunnan-demo`。公开页面通过租户 slug 读取配置，后台通过服务端验证的 Session、用户成员关系和角色读取数据。

## 当前能力

后台包含公司资料、联系方式、网站图片、旅游线路、目的地和咨询管理。目的地管理不提供图片新增或修改，已有首页目的地图片继续保留。无图片目的地只能用于行程规划。后续如需更换目的地图片，应统一进入网站图片管理能力。

第三阶段 3G 已调整为通用咨询线索接收与 ERP 同步基础架构。公开咨询请求只做服务端校验、本地 D1 持久化和同步任务创建，立即返回 `201`；独立 Worker 同步处理器负责 Provider 调用、重试、处理中断恢复和补偿建 Job。ERP Provider 默认是 `disabled`，也提供仅限本地/自动化测试的 `mock` Provider。智旅目录仅保留接入边界说明，没有编造接口字段、地址、认证信息或真实调用逻辑。

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

管理员身份模型包含 `users`、`tenant_memberships`、`sessions` 和 `admin_audit_logs`。Cookie 只保存不可预测的 Session token，数据库保存 token hash、用户、过期时间和撤销时间。密码修改会撤销该用户的旧 Session，登录、退出、密码修改及失败操作会写入不含个人信息的审计记录。在正式 MFA Provider、成员关系和权限流程完成前，服务端只允许 `qianlin-travel` 进入后台；其他租户成员即使密码正确也不能登录。

咨询数据包含同意时间、政策版本、保留截止时间和匿名化时间字段。联系方式在后台列表中脱敏，完整联系方式需要 `inquiry:read_sensitive` Permission 和已验证的管理员 Session。后台列表和详情会显示当前租户、当前 Provider 对应的 `not_configured`、`pending`、`processing`、`synced` 或 `failed` 状态；失败只显示安全错误码和通用说明，已同步时才显示外部记录 ID。`inquiry:sync_retry` 默认只授予 admin/owner，重试 API 不接受任何客户端租户或 Provider 字段。不要在日志、测试或 README 中写入真实密码、Token、手机号、邮箱或微信号。

## ERP Provider 边界

通用业务层只依赖 `ErpInquiryProvider`。可选 Provider 为 `disabled`、`mock` 和预留的 `zhilv`。ERP 配置必须来自服务端环境或租户集成配置，禁止把 API URL、Token、租户编号或用户名密码写入浏览器代码。

当前默认配置：

```text
ERP_PROVIDER=disabled
```

正式智旅 API 文档到达前，不执行真实智旅调用，不访问真实 ERP，也不提交真实密钥。Provider 解析必须接收服务端可信租户上下文；客户端不能通过 body、Header 或 query 选择 Provider。生产环境拒绝启用 `mock`。

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

## 咨询保留与匿名化

咨询写入 `retention_until`（默认 180 天）。Worker 的 `scheduled` 入口按小时运行逐租户匿名化到期记录，清空姓名、联系方式、行程和留言并保留租户边界、同意政策版本与匿名化时间。生产调度器必须为 Worker 配置同等的 hourly cron；本地配置已包含 `0 * * * *`。

## 数据库迁移

迁移文件位于 `drizzle/`，当前最新迁移为 `0011_small_triton.sql`。0011 会先检查历史同步任务是否跨租户，发现错配即中止，不会静默覆盖；之后用 `(tenant_id, inquiry_id)` 复合外键约束同租户关联。本任务不执行远程 D1 migration，不连接远程 D1，不部署生产环境。

## 尚未开放

当前未开放真实 ERP、MFA Provider、订单、支付、文件上传、WhatsApp、LINE、国际手机号、短信发送和邮件发送。Cloudflare WAF Rate Limiting 仍必须在生产控制台按上文表达式配置并由项目管理员确认；Worker 内存 Map 只作为本地/单实例的第二层保护，不能替代 WAF。由于本次明确禁止访问远程 Cloudflare，生产 WAF 和生产 cron 的实际状态未在本地验证，发布前必须完成这项人工确认。
