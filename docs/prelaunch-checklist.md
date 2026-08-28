# 黔林旅行社官网上线前检查清单

本清单用于从“本地功能完成”进入“正式生产部署”。任何涉及 Cloudflare 控制台、远程 D1、正式域名、真实账号或真实密钥的项目，都必须由项目管理员人工确认。

## Git / Code

- [ ] `main` 工作区干净
- [ ] `main` CI 全绿
- [ ] `npm ci` 成功
- [ ] `typecheck` PASS
- [ ] `lint` PASS
- [ ] `npm test` PASS
- [ ] `test:integration:local` PASS
- [ ] `build` PASS
- [ ] 生产依赖 `npm audit` high-level PASS
- [ ] 无 `tsbuildinfo`
- [ ] 无 backup 文件
- [ ] 无日志、截图或数据库文件
- [ ] 无 secrets
- [ ] 无 `.dev.vars`
- [ ] 无 `.env.local`

## 正式环境变量

以下变量名以 `.env.example` 为准。值必须由项目管理员填入正式环境；本清单不记录真实值。

- [ ] `APP_ENV=production`
- [ ] `NEXT_PUBLIC_SITE_URL=` 正式 HTTPS 域名
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 已配置
- [ ] `TURNSTILE_SECRET_KEY` 已配置
- [ ] `ADMIN_USERNAME` 已配置
- [ ] `ADMIN_PASSWORD_HASH` 已配置
- [ ] `ADMIN_TENANT_ID=qianlin-travel`
- [ ] `ITINERARY_PROVIDER=local`
- [ ] `ITINERARY_API_BASE_URL` 为空（仍使用本地规则时）
- [ ] `ITINERARY_API_KEY` 为空（仍使用本地规则时）
- [ ] `ITINERARY_API_MODEL` 为空（仍使用本地规则时）
- [ ] `ERP_PROVIDER=disabled`
- [ ] `ERP_API_URL` 为空，直到真实 ERP 接入获批
- [ ] `ERP_API_TOKEN` 为空，直到真实 ERP 接入获批
- [ ] 没有把 secret 放在任何 `NEXT_PUBLIC_*` 变量中

## 管理员安全

- [ ] 不使用开发密码
- [ ] 已生成新的生产 `ADMIN_PASSWORD_HASH`
- [ ] 密码足够强
- [ ] 明文密码不进入 Git、README 或日志
- [ ] 生产登录测试成功
- [ ] logout 成功
- [ ] 修改密码后旧 Session 被撤销
- [ ] 生产 Cookie 使用 `Secure`
- [ ] Cookie 使用 `SameSite=Lax`
- [ ] Cookie 使用 `HttpOnly`

## Cloudflare Worker

以 `worker/index.ts` 和正式部署配置为准，不凭空新增 binding。

- [ ] Worker 的 `DB` binding 已确认
- [ ] Worker 的 `ASSETS` binding 已确认
- [ ] Worker 的 `IMAGES` binding 已确认
- [ ] `APP_ENV=production` variable 已确认

## D1

- [ ] 已创建或确认正式 D1 database
- [ ] Worker 的 DB binding 指向正式 D1
- [ ] 如已有数据，已先备份正式 D1
- [ ] 已检查 `drizzle/` 的全部 migration
- [ ] 正式 D1 migration 已全部应用
- [ ] 上线流程中没有执行 `db:reset:local`
- [ ] 没有上传本地 `.wrangler/state`
- [ ] `qianlin-travel` 租户数据存在
- [ ] `site_status=published` 已确认

当前仓库最新 migration：`drizzle/0014_controlled_theme_studio.sql`。

## 正式数据检查

- [ ] 公司中文名、英文名、地址、电话、微信、邮箱均为真实资料
- [ ] Hero、About、Customize 图片均为正式资料
- [ ] 首页目的地资料已确认
- [ ] 参考方案不包含虚构价格
- [ ] 正式数据不包含 `Local test`、`functional test`、`fictional`、测试用户、Cross tenant inquiry、`@example.invalid` 或 mock customer
- [ ] 已区分本地隔离 D1 测试数据与生产数据

## Turnstile

- [ ] 已创建正式 Cloudflare Turnstile site
- [ ] 正式域名已加入 allowed hostname
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 正确
- [ ] `TURNSTILE_SECRET_KEY` 正确
- [ ] 正式咨询可以通过验证
- [ ] 错误 token 会被拒绝
- [ ] 未配置生产 Turnstile 时不会上线公开咨询

## WAF Rate Limiting

管理员登录规则：

```text
http.request.uri.path eq "/api/admin/login"
and http.request.method eq "POST"
```

公开咨询规则：

```text
http.request.uri.path matches "^/api/t/[^/]+/inquiries$"
and http.request.method eq "POST"
```

- [ ] login WAF rule 已配置
- [ ] inquiry WAF rule 已配置
- [ ] 正式 Host 条件已确认
- [ ] Source IP 计数维度已确认
- [ ] login 阈值（建议 5 次 / 10 分钟）已人工确认
- [ ] login block action（建议阻断 15 分钟）已人工确认
- [ ] inquiry 阈值（建议 5 次 / 10 分钟）已人工确认
- [ ] inquiry block action（建议阻断 10 分钟）已人工确认
- [ ] 未把 Worker 内存 rate limit 当作 WAF 替代

## Cron

Worker 需要每小时执行 scheduled maintenance：`0 * * * *`。

- [ ] production Worker 配置 hourly cron
- [ ] cron 实际触发
- [ ] inquiry retention 正常
- [ ] expired session cleanup 正常
- [ ] ERP sync reconciliation 不报错
- [ ] `ERP_PROVIDER=disabled` 时 `not_configured` 不被误判为咨询保存失败

## 域名与 SEO

- [ ] 正式域名确定
- [ ] DNS 正确
- [ ] Cloudflare custom domain 正确
- [ ] HTTPS 正常
- [ ] HTTP → HTTPS 正常
- [ ] www / non-www 策略确定
- [ ] `NEXT_PUBLIC_SITE_URL` 与正式 canonical 一致
- [ ] 首页 title、description、canonical、OpenGraph、Twitter metadata、og image 正确
- [ ] `sitemap.xml` 正确
- [ ] `robots.txt` 正确
- [ ] `qianlin-travel` published 状态为 index/follow
- [ ] `yunnan-demo` 不进入正式 sitemap 且不被正常索引
- [ ] 后台页面为 noindex

## 法律页面

- [ ] Privacy Policy 中文已确认
- [ ] Privacy Policy 英文已确认（如对外提供英文）
- [ ] Terms 已确认
- [ ] Refund / Cancellation 已确认
- [ ] `policyVersion` 正确
- [ ] inquiry privacy consent 对应当前 `policyVersion`
- [ ] 法律页没有承诺不存在的在线支付、实时退款、固定团期或库存

## 页面错误与降级

- [ ] 404 页面
- [ ] configuring tenant 页面
- [ ] 无 tours 时首页仍完整
- [ ] 无 destination 图片时显示 `destination-image-fallback`
- [ ] Hero 图片失败时不白屏
- [ ] API 临时失败有用户可理解提示
- [ ] Planner options 加载失败可以 retry
- [ ] 咨询提交失败显示明确提示
- [ ] 当前不存在但本次不追加的大范围功能已标为 BLOCKER 或 FOLLOW-UP

## Theme Studio

- [ ] 后台有“进入可视化编辑器”
- [ ] viewer 只能查看
- [ ] editor 可以保存 draft
- [ ] admin / owner 可以 publish
- [ ] modern 可以预览
- [ ] natural 可以预览
- [ ] elegant 可以预览
- [ ] youthful 可以预览
- [ ] Save draft 不影响官网
- [ ] Publish 后 `site-config` 改变
- [ ] Publish 后前台 CSS 实际改变

## 咨询链路

- [ ] 官网可以打开咨询
- [ ] 姓名、手机、人数、privacy 验证正常
- [ ] TravelPreferences 可以 prefill
- [ ] Planner 可以 prefill places + message
- [ ] 提交成功
- [ ] 后台 list 收到
- [ ] 后台 detail 能看到 name、phone、wechat、email、location、travelDate、travelers、duration、tourName、places、message
- [ ] 状态可以使用 `new`、`contacted`、`following_up`、`completed`、`closed`

## 生产测试数据

- [ ] production D1 没有 synthetic inquiry
- [ ] production D1 没有 Local regression user、Local functional test、Cross tenant inquiry 或 `example.invalid`
- [ ] 没有 mock ERP records
- [ ] 没有运行会误删真实 inquiry 的通配 DELETE
- [ ] 如发现测试数据，已按明确 ID / submissionId 审核后处理

## 上线后 24 小时观察

- [ ] Worker 5xx
- [ ] inquiry 4xx / 5xx
- [ ] admin login failures
- [ ] D1 errors
- [ ] Turnstile failures
- [ ] Cron
- [ ] 页面图片 404
- [ ] site-config errors
- [ ] planner errors
- [ ] 日志没有记录完整手机号、微信、邮箱或 message

## 管理员人工签字

- [ ] Cloudflare 控制台项目已人工确认
- [ ] 远程 D1 项目已人工确认
- [ ] 正式域名与 DNS 已人工确认
- [ ] 真实账号与密钥已由项目管理员确认
- [ ] 所有 blocker 已关闭，或已明确接受风险
