# 黔林旅行社官网

这是一个以黔林旅行社为正式租户的旅行咨询网站第一版。当前版本提供首页、目的地展示、智能行程规划、咨询表单、联系方式和法律页面；不包含后台管理、订单、支付或报价系统。

首页主要视觉是 AI 主题图片轮播。图片用于营造旅行主题氛围，不声明为具体贵州景点的真实实拍，也不声明为旅行社带团记录。

## 技术栈

- Next.js、React、TypeScript
- Vinext / Cloudflare Workers
- Drizzle ORM / Cloudflare D1
- Node.js `>=22.13.0`

## 本地运行

```bash
npm install
npm run dev
```

本地 D1 只使用项目内的 Wrangler 配置和 `.wrangler/state`：

```bash
npm run db:reset:local
npm run db:check:local
```

`db:reset:local` 会重建本地数据库并应用全部迁移。不要使用这些命令连接线上 D1；本阶段不创建线上资源、不执行远程迁移、不部署网站。

## 多租户基础

当前已完成未来 SaaS 改造所需的最小租户基础，但没有实现后台或管理员功能：

- `qianlin-travel` 是正式租户，根路径 `/` 使用 D1 中的站点资料、联系方式和 Hero 配置。
- `yunnan-demo` 是演示租户，路径为 `/t/yunnan-demo`。它使用“云途旅行（演示）”资料，不含正式租户的联系方式、Hero、目的地或规划数据，也不接受咨询，设置为 `noindex,nofollow`。
- 其他新租户默认处于 `configuring` 状态。没有已发布站点资料时，只显示独立的配置中页面，不显示正式租户内容或咨询入口。
- 租户站点配置、规划选项和咨询接口分别使用 `/api/t/:tenantSlug/site-config`、`/api/t/:tenantSlug/planner/options` 和 `/api/t/:tenantSlug/inquiries`。
- 数据库中的站点资料、联系方式、Hero、咨询和规划城市/目的地均按 `tenant_id` 隔离；`0004` 迁移补充了外键、状态约束、索引和无默认租户的咨询表。

正式租户的贵州城市和目的地数据仍保存在 D1 迁移中，这是该租户的业务数据，不是其他租户的默认回退数据。公开公司资料统一来自 D1，不会使用静态文件作为其他租户的回退内容。

## 图片和页面结构

Hero 配置由 D1 的 `tenant_hero_slides` 提供，当前正式租户最多展示两张本地 Hero 图片，轮播间隔约 6 秒。支持上一张、下一张、圆点、键盘操作、悬停暂停、控制区聚焦暂停、页面不可见时暂停，以及 `prefers-reduced-motion`。

首页保留的图片区域为 Hero、线路卡片、目的地卡片、定制咨询图和关于我们图。不会加入图集、视频、带团照片或游客合照模块。

## 智能行程规划

规划器使用 D1 返回的当前租户数据，通过统一的 `generateItinerary()` 接口调用本地规则 provider。当前不会请求外部地图、模型或路线 API，也不会产生外部 API 费用。未来接入外部服务时，应由服务端 provider/adapter 完成密钥保护、响应校验和内部类型转换。

规划结果仅供前期参考，不代表实时最优路线、实际车程或最终服务确认。当前没有在线支付、订单和退款办理功能。

## 环境变量

`.env.example` 不包含真实密钥。Turnstile 目前尚未真正启用，只保留变量和正式上线前的配置位置；不能据此认为网站已经接入 Turnstile。

行程规划当前使用本地 provider：

```env
ITINERARY_PROVIDER=local
```

正式上线前请在受控环境完成 D1、域名、咨询接收和安全配置，并进行真实提交测试。

## 检查与测试

```bash
npm run lint
npm run build
npm test
npm run test:integration:local
```

`npm test` 覆盖构建后的基础页面/源代码约束、租户隔离、规划数据和咨询接口边界。`npm run test:integration:local` 会使用独立的 `.wrangler/test-state`，从全部迁移开始执行真实本地 D1 SQL 检查，结束后自动清理，不影响日常 `.wrangler/state`。

## 当前明确不包含

本阶段不包含管理员登录、后台管理、租户创建平台、子域名解析、订单中心、在线支付、微信/支付宝收款、退款办理、报价系统、地图或外部 API 接入、模型 API 接入、线上 D1 资源和网站部署。
