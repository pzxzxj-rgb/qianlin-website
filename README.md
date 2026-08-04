# 黔林旅行社官网第一版

这是黔林旅行社的国内旅游官网第一版，当前定位是“贵州旅游展示 + 游客咨询收集”。项目保持单商家结构，已为未来的数据层和 SaaS 多租户改造保留清晰的数据边界，但当前不实现多租户或后台管理。

## 当前版本定位

- 面向国内游客的贵州旅游官网，提供中英文展示。
- 首页包含 Hero、线路、目的地、服务介绍、咨询流程、定制咨询、公司介绍、图片画廊、FAQ 和联系方式。
- 咨询表单提交到 `/api/inquiries`，经过服务端校验后写入 D1 `inquiries` 表。
- 当前不提供注册、登录、个人中心、订单、在线支付、机票/酒店出票、后台管理、App、小程序或第二个商家。
- 当前表单仅使用手机号、微信号、邮箱等国内联系方式。

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

`npm test` 会先构建项目，再运行 Worker 渲染和 API 输入校验测试。

## 项目结构

```text
app/
  api/inquiries/route.ts   咨询 API 与服务端校验
  privacy/page.tsx         隐私政策
  terms/page.tsx           用户服务条款
  refund/page.tsx          退款与取消政策
  sitemap.ts               sitemap.xml
  robots.ts                robots.txt
  page.tsx                 首页组合与弹窗状态
components/                首页模块、导航和咨询弹窗
data/
  siteConfig.ts            公司、联系方式和图片集中配置
  tours.ts                 旅游线路数据
  destinations.ts          目的地数据
  faq.ts                   常见问题
  translations.ts          中英文界面文案
  legal.ts                 法律页面内容
db/schema.ts               D1/Drizzle 咨询表结构
drizzle/                   迁移文件与元数据
public/                    favicon、分享图和已有图片资源
tests/                     页面、路由和 API 基础测试
worker/index.ts            Worker 入口
```

## 内容修改入口

- 公司名称、地址、电话、邮箱、微信号、公司介绍和图片入口：`data/siteConfig.ts`。
- 线路：`data/tours.ts`。
- 目的地：`data/destinations.ts`。
- 首页模块文案：`data/translations.ts`。
- FAQ：`data/faq.ts`。
- 隐私政策、服务条款、退款政策：`data/legal.ts`。
- 组件只负责展示和交互，不在组件内重复维护公司资料。

## 咨询流程

游客可以点击导航、Hero、线路卡片或“定制我的旅程”打开咨询弹窗。点击具体线路时，线路名称会预填到表单，游客仍可编辑或清空。表单必填姓名、手机号、出行人数和隐私同意；微信号、邮箱、地区、日期、时长、线路、目的地和留言为选填项。

浏览器端提供基础交互校验，服务端会再次校验 JSON 格式、请求体大小、字段类型与长度、手机号、邮箱、出行日期、选项值、隐私同意和隐藏蜜罐字段。保存失败时保留原表单内容，不显示 SQL 或 D1 内部错误。

## D1 与迁移

`db/schema.ts` 是当前唯一的咨询表定义，表名为 `inquiries`，包含姓名、手机号、微信号、邮箱、出行需求、隐私同意、状态和创建时间。表中不保存身份证、护照、银行卡或支付密码。

本项目当前没有正式部署到生产 D1。由于初始迁移尚未用于正式数据库，本轮将初始迁移按当前 schema 重建为新的基线：

```bash
npm run db:generate
```

`.openai/hosting.json` 保留了 D1 绑定名 `DB`，不代表已经存在可用的线上数据库。本轮不执行 Cloudflare 资源创建、迁移应用或部署。

## 环境变量

复制 `.env.example` 后按本地环境填写：

- `NEXT_PUBLIC_SITE_URL`：公开站点 URL；本地可使用 `http://localhost:3000`。
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY`：当前版本尚未真正启用 Turnstile，仅保留环境变量和正式上线前的配置说明；本地没有 key 时仍可提交测试。

正式上线前，如果没有可靠的边缘限流，应配置 Cloudflare Rate Limiting 或 Turnstile。当前项目没有伪造的内存限流实现。

## 上线前检查清单

1. 配置真实的 `NEXT_PUBLIC_SITE_URL`。
2. 确认隐私政策、用户服务条款和退款政策经过业务及法律审核。
3. 配置并验证正式 D1 绑定、迁移和访问权限。
4. 配置 Cloudflare Rate Limiting 或 Turnstile。
5. 验证咨询提交、重复点击、失败重试和工作人员联系方式。
6. 在 320、375、390、768、1024、1440 像素宽度检查页面。
7. 检查键盘焦点、Esc 关闭弹窗、隐私政策新窗口和移动端导航。
8. 检查分享图、favicon、canonical、sitemap 和 robots。
9. 检查电话、邮箱、微信号、地址与营业资料保持一致。

## 图片替换清单

本轮没有替换图片。当前 `data/siteConfig.ts`、`data/destinations.ts` 和 `data/tours.ts` 中仍有用于开发展示的远程图片地址；它们不应被当作已核验的贵州实景或已获得商用授权的素材。上线前请使用已确认地点、版权和压缩规格的图片替换：

- 首页 Hero、公司介绍、定制区域和画廊六张图：`data/siteConfig.ts`。
- 黄果树、西江苗寨、荔波小七孔、梵净山、青岩古镇、镇远古镇：`data/destinations.ts`。
- 每条线路对应图片：`data/tours.ts`。

项目中已有的 `public/images/guizhou/` 文件属于之前的本地素材准备，本轮不改变其引用关系。

## 当前未包含

多租户、后台管理、账号体系、订单中心、在线支付、自动退款、机票/酒店/门票出票、库存、实时价格、消息中心、App、小程序、正式生产部署和线上 D1 资源均不在第一版范围内。

## 后续路线图

1. 先完成真实图片、法律文本、D1 资源和上线安全配置的验收。
2. 根据实际咨询量补充工作人员查看咨询的安全后台。
3. 在明确数据边界和租户模型后，再进行数据库化与 SaaS 多租户改造。
