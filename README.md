# 黔林旅行社官网第一版

这是黔林旅行社的贵州旅游咨询官网第一版。当前版本保持单商家结构，主要用于展示贵州目的地、提供旅行咨询入口和收集游客需求；暂不实现后台管理、多租户、固定线路商品、在线支付或订单中心。

## 当前版本定位

- 默认使用中文界面，用户可以切换英文；语言偏好保存在浏览器 `localStorage` 的 `qianlin-language` 中。
- 首页主要视觉为本地 AI 主题图片 Hero 轮播。图片仅作为贵州旅游主题视觉，不宣传为某个具体景点的真实实拍，也不宣传为黔林旅行社带团记录。
- 首页不保留独立 Gallery 图集模块。
- 当前没有经过确认的固定旅游线路，因此首页不会展示虚构的线路卡片、价格或在线预订入口。
- 目的地卡片用于发起咨询，点击后会打开咨询表单并预填对应地点；联系方式按钮也会直接打开咨询表单。

## 技术栈

- Next.js／React／TypeScript
- Cloudflare Workers／Vinext
- Drizzle ORM／Cloudflare D1 接口预留
- Node.js `>=22.13.0`

## 本地运行

```bash
npm install
npm run dev
```

生产构建和测试：

```bash
npm run lint
npm run build
npm test
```

测试会覆盖首页服务端输出、中文默认状态、Hero 基本无障碍属性、法律页面、sitemap、robots、咨询接口校验，以及未来线路筛选函数。

## 项目结构

```text
app/
  api/inquiries/route.ts   咨询 API 与服务端校验
  privacy/page.tsx         隐私政策
  terms/page.tsx           用户服务条款
  refund/page.tsx          退款与取消政策
  page.tsx                 首页模块组合与咨询弹窗状态
components/                首页模块、导航、Hero 轮播和咨询弹窗
data/
  siteConfig.ts            公司信息、联系方式和 Hero 图片配置
  tours.ts                 当前固定线路配置，当前为空数组
  destinations.ts          贵州目的地数据
  translations.ts          中英文界面文案
  faq.ts                   常见问题
  legal.ts                 法律页面内容
types/tour.ts              未来线路数据类型
lib/tours.ts               未来线路筛选与排序函数
lib/itinerary/             供应商无关的行程规划类型、入口和本地 provider
db/schema.ts               D1／Drizzle 咨询表结构
drizzle/                   迁移文件与元数据
public/images/hero/        本地 Hero WebP 图片
tests/                     页面、线路筛选和 API 基础测试
worker/index.ts            Worker 入口
```

公司名称、地址、联系方式、介绍、图片和 Hero 轮播顺序集中在 `data/siteConfig.ts`；目的地集中在 `data/destinations.ts`。未来接入真实线路数据时，线路应带有 `tenantId`、`status`、`featured` 和 `displayOrder`，首页只读取当前旅行社的已发布精选线路。

## Hero 图片

Hero 当前使用 4 张 `public/images/hero/` 中的本地 WebP 图片，轮播顺序、双语 alt 文案以及桌面端／手机端定位均配置在 `data/siteConfig.ts`。每张图展示约 6 秒，支持上一张、下一张、圆点、悬停暂停、控制区域聚焦暂停、页面不可见时暂停和 `prefers-reduced-motion`。

这些图片是贵州山水、自然风光和民族文化主题的 AI 视觉素材，不对应特定景点实拍。原始压缩包 `图.zip` 已加入本地忽略规则，不应提交到 GitHub；如不再使用，请将它移出项目目录。

## 智能行程规划与外部服务接入设计

首页的“智能行程规划”当前使用本地规则生成器。游客选择景点、出行天数、人数、出发城市和结束城市后，系统会按景点区域和基础行程强度整理按天展示的参考行程，并标记暂未安排的景点。结果可以带入现有咨询表单提交给旅行顾问。

页面只依赖统一入口 `generateItinerary()`，不直接调用本地 provider，也不依赖任何供应商 SDK。当前 provider 为 `local`，本轮不调用真实外部 API、不创建 API Key、不填写外部地址，也不会产生外部 API 费用。

行程核心类型位于 `lib/itinerary/types.ts`，统一入口位于 `lib/itinerary/generateItinerary.ts`，本地实现位于 `lib/itinerary/providers/localItineraryProvider.ts`。未来可增加外部 provider 或 adapter，用于对接大模型、地图路线服务、专业行程服务或自建后端；外部返回必须先校验并转换为内部 `ItineraryPlan`，不能把供应商原始字段直接交给前端。

未来接入外部服务时，必须由项目服务端调用，浏览器不能直接请求供应商接口。API Key 只能放在服务端环境变量中，不能使用 `NEXT_PUBLIC_` 前缀，也不能进入浏览器。更换供应商时应主要替换 provider、adapter 和服务端配置，不需要重写景点选择、结果展示或咨询表单。外部服务失败时未来可以配置本地 provider 作为回退，但本轮未实现复杂重试或自动回退。

当前 `.env.example` 只预留通用空配置，并明确使用 `ITINERARY_PROVIDER=local`；未确定最终供应商前，不写死具体厂商、模型或 Base URL。

## 咨询与数据

游客可以通过 Hero、定制咨询区、联系方式或目的地卡片打开咨询表单。表单提交到 `/api/inquiries`，服务端会校验字段、隐私同意和蜜罐字段。

`db/schema.ts` 和迁移文件已为 `inquiries` 咨询表准备好结构，但当前开发环境没有创建线上 D1 资源，也没有部署网站。正式上线前需要创建 D1、绑定 `DB`、执行 migration，并完成线上真实提交测试和运营人员接收咨询的配置。

`.env.example` 只包含本地站点地址以及 Turnstile 配置占位符。当前版本尚未真正启用 Cloudflare Turnstile 或 Cloudflare Rate Limiting；正式公开上线前需要完成其中适用的防护配置和服务端校验，未配置时不代表生产环境已经安全。不要把真实密钥提交到仓库。

## 当前不包含

本版本不包含多租户查询、租户识别、子域名解析、后台管理、管理员登录、线路数据库、线路 API、订单中心、在线支付、库存、实时价格、消息中心、App、小程序、正式部署或线上 D1 资源。
