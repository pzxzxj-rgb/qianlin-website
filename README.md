# 黔林旅行社官网第二版

当前版本先服务中国大陆用户。默认语言为中文，咨询表单只接受中国大陆 11 位手机号码，联系方式保留微信、电话和邮箱。项目已完成最小多租户基础，正式租户为 `qianlin-travel`，演示租户为 `yunnan-demo`。

## 当前能力

* D1 保存租户资料、公开联系方式、Hero 图片、贵州目的地、行程规划选项和咨询记录。
* 每个租户通过自己的 slug 读取公开资料。服务端以路由租户为准，不信任客户端提交的 `tenantId`。
* 正式租户可以展示网站和接收咨询。演示租户与 configuring 租户不接收真实咨询。
* 首页保留 Hero、线路、目的地、行程规划、定制咨询、关于我们和联系方式等现有模块。后台目前提供管理员登录、只读概况、公司资料编辑和已有本地图片管理，不包含订单或支付系统。
* Hero 使用 D1 中最多两张本地图片。图片只作为旅行主题视觉使用，页面不把 AI 图片描述成具体景点实拍或带团记录。
* 行程规划当前使用本地规则 provider，没有调用地图、模型或外部路线 API。

## 第三阶段后台

* 已完成管理员登录。
* 已完成只读后台。
* 已完成公司资料编辑。
* 已完成网站图片管理，管理员可以从项目内置白名单选择 Hero、About 和 Customize 图片，并编辑对应 alt 与 Hero 显示位置。
* 已完成联系方式管理，管理员可以编辑现有电话、微信和邮箱记录的类型、双语显示名称、内容、跳转链接、显示顺序和状态。
* 线路管理已完成，管理员可以新增和编辑旅游线路，并设置推荐、排序和草稿、已发布、已归档状态。
* 线路图片只能选择项目内置白名单，后台不支持详细每日行程、价格库存、订单、支付和永久删除。
* 第三阶段 3F：后台目的地管理已完成，管理员可以新增和编辑贵州目的地，并设置首页展示、规划器可用、主要景点、卡片大小、排序和草稿、已发布、已归档状态。
* 目的地管理不提供图片新增或修改，已有首页目的地图片继续保留；无图片目的地只能用于行程规划。
* 后续如需更换目的地图片，应统一进入网站图片管理能力。目的地管理不支持省份和城市管理、地图、门票、开放时间、实时车程或永久删除；不再使用的目的地通过归档状态保留。
* 建议游览时长目前仅作为参考资料保存，暂不参与自动行程计算；主要景点字段只作为目的地标签保存。
* 当前只允许编辑 `qianlin-travel` 的公司名称、介绍、地址和 Logo 文字标志。
* 图片管理不支持电脑文件上传、R2、Hero 新增或删除，图片只能使用项目内置白名单中的本地路径。
* 联系方式管理不支持自定义类型、联系方式图标上传、批量操作或拖拽排序。
* 第三阶段 3G：后台咨询管理 MVP 已完成，支持咨询列表、分页、状态筛选、脱敏摘要、详情查看和状态更新，固定限定 `qianlin-travel` 租户。
* 3G 暂不包含 CRM、自动短信、自动微信、邮件营销、客服分配、多管理员权限、永久删除、Excel 导出、AI 自动回复、订单和支付。
* 后台写操作使用 HttpOnly Session、固定租户边界和同源请求验证。
* 真实管理员密码、密码哈希和 Session Secret 不记录在 README 或代码中。

## 本地运行

```bash
npm ci
npm run db:reset:local
npm run dev
```

本地 D1 使用 `wrangler.local.jsonc` 和 `.wrangler/state`。本地重置命令只操作项目工作区内的本地数据库，不连接远程 D1。

```bash
npm run db:check:local
npm run db:inquiries:local
```

咨询记录保存在 `inquiries` 表。默认查看脚本只显示 `id`、`tenant_id`、`status` 和 `created_at`，不会输出手机、微信、邮箱或完整留言。查询脚本不会写入测试数据。

正式环境可在完成 Cloudflare 登录和权限确认后使用 Wrangler 的远程查询流程，例如：

```bash
npx wrangler d1 execute <D1_DATABASE_NAME> --remote --command "SELECT id, tenant_id, status, created_at FROM inquiries ORDER BY id DESC LIMIT 50"
```

远程查询前必须确认数据库名称、环境和权限。不要把生产咨询数据复制进测试数据库，也不要在普通日志中打印完整个人信息。后台咨询列表、详情和状态管理已在 3G MVP 中提供，生产部署前仍需单独确认权限、审计和脱敏配置。

## 租户边界

公开租户资料使用以下接口：

* `/api/t/:tenantSlug/site-config`
* `/api/t/:tenantSlug/planner/options`
* `/api/t/:tenantSlug/inquiries`

只有 active 且 published 的正式租户才能正常展示完整资料和提交咨询。configuring 租户的公开配置接口只返回 slug、租户名称、状态、默认语言和空白资料。演示租户不接收真实咨询，也不会进入 sitemap。

## Turnstile 与环境变量

`.env.example` 不含真实密钥。表单包含蜜罐和 Turnstile token，服务端负责最终校验。

* 本地开发在两个 Turnstile 变量都为空时明确关闭校验。
* 生产环境必须同时设置 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 和服务端专用的 `TURNSTILE_SECRET_KEY`。缺少配置时咨询提交会被拒绝。
* Secret Key 只能放在服务端环境变量中，不能使用 `NEXT_PUBLIC_` 前缀，也不能提交到 GitHub。
* 正式上线前应在 Cloudflare 控制台配置 WAF Rate Limiting 规则。当前不新增 KV、Durable Object 或 Cloudflare Rate Limiting 资源。

## CI 与生产频率限制

`.github/workflows/ci.yml` 使用 Node.js 22 和 npm 缓存，依次执行 `npm ci`、`npm run lint`、`npm run build`、`npm test` 和 `npm run test:integration:local`。这些步骤位于同一个必需的 CI Job 中，任一步失败都会使 Job 失败。GitHub 仓库的 main 分支规则还必须把 `lint, build, and tests` 设为 Required status check，并开启合并前必须通过检查。

生产环境不要在应用内引入 KV 或 Durable Object 来实现频率限制。请在 Cloudflare 控制台的 WAF Rate Limiting rules 中创建以下规则，Host 条件替换为正式站点域名：

1. 管理员登录失败限制

   Matching expression：

   ```text
   http.request.uri.path eq "/api/admin/login" and http.request.method eq "POST"
   ```

   Counting expression：

   ```text
   http.request.uri.path eq "/api/admin/login" and http.request.method eq "POST" and http.response.code eq 401
   ```

   按 Source IP 计数，建议 5 次 / 10 分钟，触发后 Block 15 分钟。登录接口当前错误密码返回 401，因此该规则只累计连续失败登录，不累计成功登录。

2. 公开咨询提交限制

   Matching expression：

   ```text
   http.request.uri.path matches "^/api/t/[^/]+/inquiries$" and http.request.method eq "POST"
   ```

   按 Source IP 计数，建议 5 次 / 10 分钟，触发后 Block 10 分钟。该规则覆盖所有租户路径，避免攻击者通过切换 tenant slug 绕过限制。保留现有 Turnstile 和服务端校验作为第二层保护。

   Cloudflare 文档说明了请求路径、方法、Source IP、响应码计数表达式以及周期和触发后的缓解时间配置，正式上线前应在 Request rate analysis 中根据真实流量复核阈值：[Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)、[Rate limiting best practices](https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/)。

生产环境必须设置真实的 `NEXT_PUBLIC_SITE_URL`，不能使用 `localhost`、`127.0.0.1` 或 `::1`。缺少配置或配置为本地地址时，生产 URL 工具会抛出明确错误，canonical 不会回退到本地地址。开发和测试环境可以使用 `http://localhost:3000`。

## 数据库迁移

迁移文件位于 `drizzle/`。最新数据迁移会把正式租户的定制咨询图片切换为项目内的贵州主题图片。不要直接修改 `.wrangler/state`，不要在本地提交数据库文件，也不要执行远程 migration。

## 检查命令

```bash
npm run lint
npm run build
npm test
npm run test:integration:local
```

`npm test` 包含构建后源代码约束测试。`npm run test:integration:local` 使用独立的 `.wrangler/test-state` 应用全部迁移并检查本地 D1 的租户约束、资料隔离和咨询表外键，不影响日常本地数据库。

## 当前明确不包含

当前版本不包含国际手机号、WhatsApp、LINE、东南亚语言、独立英文 URL、在线支付、订单系统、3H 后续 CRM 能力、商家注册、子域名租户、外部地图 API、模型 API、正式线上 D1 资源和网站部署。上述能力留到后续版本评估。
