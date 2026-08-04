# 黔林旅行社官网第一版

这是黔林旅行社的贵州旅游官网第一版，当前定位为“贵州旅游展示 + 游客咨询收集”。项目保持单商家结构，同时把线路数据边界整理为未来 SaaS 多旅行社改造可以替换的数据接口；当前不实现后台、线路数据库、线路 API 或真正的多租户系统。

## 当前版本定位

- 首页使用本地 AI 主题视觉图 Hero 轮播，不把图片宣传为特定景点实拍或带团记录。
- 首页保留 Hero、目的地、服务介绍、咨询流程、定制咨询、公司介绍、FAQ 和联系方式。
- 首页 Gallery 模块已删除，不再保留“体验贵州”图集。
- 黔林旅行社当前没有经过确认的固定线路，首页不展示虚构或演示线路，也不展示虚构价格。
- 咨询表单提交到 `/api/inquiries`，经过服务端校验后写入 D1 `inquiries` 表；本轮线路调整不影响咨询表单、咨询 API 或数据库。

## 技术栈与运行

- Next/Vinext、React、TypeScript、Tailwind CSS。
- Cloudflare Workers/Vinext 运行时，Drizzle ORM，Cloudflare D1。
- Node.js `>=22.13.0`。

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

`npm test` 会先构建项目，再运行首页、法律页面、线路筛选和 API 输入校验测试。

## 项目结构

```text
app/
  api/inquiries/route.ts   咨询 API 与服务端校验
  privacy/page.tsx         隐私政策
  terms/page.tsx           用户服务条款
  refund/page.tsx          退款与取消政策
  page.tsx                 首页组合与弹窗状态
components/                首页模块、导航、线路展示和咨询弹窗
data/
  siteConfig.ts            公司、联系方式和 Hero 图片配置
  tours.ts                 当前旅行社线路配置，当前为空数组
  destinations.ts          目的地数据
  translations.ts          中英文界面文案
  faq.ts                   常见问题
  legal.ts                 法律页面内容
types/tour.ts              线路前端数据类型
lib/tours.ts               线路筛选与排序函数
db/schema.ts               D1/Drizzle 咨询表结构
drizzle/                   迁移文件与元数据
public/images/hero/        已优化的本地 Hero WebP 图片
tests/                     页面、线路筛选和 API 基础测试
worker/index.ts            Worker 入口
```

## 内容与数据边界

- 公司名称、地址、联系方式、介绍和图片入口：`data/siteConfig.ts`。
- 当前黔林线路数组：`data/tours.ts`，目前为 `tours: []`，不放入未经确认的线路。
- 线路类型：`types/tour.ts`。
- 线路筛选：`lib/tours.ts`。
- 目的地：`data/destinations.ts`。
- 首页文案：`data/translations.ts`。
- 隐私政策、服务条款、退款政策：`data/legal.ts`。

线路组件只接收线路数组并负责展示，不直接查询 D1，也不处理后台逻辑。未来首页通过当前旅行社的 `tenantId` 筛选 `published` 且 `featured` 的线路，按 `displayOrder` 排序并限制数量；有可展示线路时，线路模块、导航入口和 Hero 探索入口会自动重新出现。

## 当前线路状态

当前黔林旅行社没有确认的固定线路，因此首页不会渲染线路模块、线路卡片、线路价格说明、主导航线路入口、Footer 线路入口或 Hero“探索线路”按钮。页面会从 Hero 自然衔接到目的地和其他现有模块。

未来接入真实线路数据时，每条线路应属于一个旅行社，至少包含：

```text
tenantId
status: draft | published | archived
featured
displayOrder
```

不同旅行社只能读取和维护自己的线路。每个旅行社未来通过自己的后台新增、修改、排序、发布和下架线路；平台不共享一套固定线路数据。

## Hero 与图片

首页 Hero 使用 `public/images/hero/` 中的本地 AI 主题视觉图轮播。轮播顺序、稳定 id、双语 alt 文案和电脑端/手机端裁剪位置集中配置在 `data/siteConfig.ts` 的 `heroSlides` 中。

这些图片不是特定贵州景点的真实实拍，也不是黔林旅行社带团记录。项目没有从网络下载新的图片。`图.zip` 只作为本地处理输入，并已由 Git 忽略，不应提交到 GitHub。

## 咨询与 D1

游客可以点击导航、Hero 或定制区域打开咨询弹窗。点击未来的具体线路时，线路名称仍可预填到咨询表单。表单必填姓名、手机号、出行人数和隐私同意；服务端会再次校验请求格式、字段长度、手机号、邮箱、隐私同意和蜜罐字段。

`db/schema.ts` 当前只定义 `inquiries` 咨询表。本轮不创建 `tours` 或 `tenants` 表，不修改 inquiries migration、咨询 API 或咨询表单字段。

## 环境变量与上线

复制 `.env.example` 后按本地环境填写。Turnstile 环境变量目前只是保留配置入口，尚未真正启用。

本项目当前不创建 Cloudflare 线上资源、不应用 D1 迁移、不部署网站。正式上线前仍需确认域名、法律文本、图片授权、D1 绑定、限流或 Turnstile 配置及工作人员联系方式。

## 当前未包含

多租户查询、租户识别、子域名解析、后台管理、管理员登录、线路数据库、线路 API、订单中心、在线支付、库存、实时价格、消息中心、App、小程序、正式生产部署和线上 D1 资源均不在当前版本范围内。
