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
* 当前只允许编辑 `qianlin-travel` 的公司名称、介绍、地址和 Logo 文字标志。
* 图片管理不支持电脑文件上传、R2、Hero 新增或删除，图片只能使用项目内置白名单中的本地路径。
* 联系方式管理不支持自定义类型、联系方式图标上传、批量操作或拖拽排序。
* 线路、目的地和咨询管理仍未开放。
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

远程查询前必须确认数据库名称、环境和权限。不要把生产咨询数据复制进测试数据库，也不要在普通日志中打印完整个人信息。当前仍没有咨询列表、咨询详情或咨询状态管理，后续如需这些能力，需要单独设计权限、审计和脱敏方案。

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
* 正式上线前还应在 Cloudflare 控制台配置访问频率限制。当前没有新增 KV、Durable Object 或 Rate Limiting 资源。

生产环境必须设置真实的 `NEXT_PUBLIC_SITE_URL`，例如 `https://www.example.com`。开发和测试环境可以回退到 `http://localhost:3000`。生产环境缺少该变量时，URL 工具会抛出明确配置错误，canonical、sitemap、robots 和 Open Graph 不会默默使用 localhost。

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

当前版本不包含国际手机号、WhatsApp、LINE、东南亚语言、独立英文 URL、在线支付、订单系统、完整咨询管理后台、商家注册、子域名租户、外部地图 API、模型 API、正式线上 D1 资源和网站部署。上述能力留到后续版本评估。
