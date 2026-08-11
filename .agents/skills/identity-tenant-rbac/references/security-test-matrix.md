# Identity / RBAC Security Test Matrix

任何会改变登录、Session、Cookie、User、Tenant、Membership、Role、Permission、PII、Owner、MFA、密码、Audit 或身份 Schema 的代码修改，都必须读取并执行本文件要求。

本文件定义可执行的 Identity / RBAC 安全测试矩阵。

关键权限行为不得只依赖源码搜索、正则或 Mock，必须通过真实本地 D1 和真实本地 HTTP 流程验证。

## 目录

- [使用场景](#使用场景)
- [测试环境要求](#测试环境要求)
- [当前项目已经实现](#当前项目已经实现)
- [当前生产限制](#当前生产限制)
- [HTTP 状态语义](#http-状态语义)
- [Authentication 测试](#authentication-测试)
- [Session 测试](#session-测试)
- [User 与 Membership 状态测试](#user-与-membership-状态测试)
- [Role / Permission 测试](#role--permission-测试)
- [PII 脱敏测试](#pii-脱敏测试)
- [跨 Tenant 测试](#跨-tenant-测试)
- [Owner 保护测试](#owner-保护测试)
- [MFA 测试](#mfa-测试)
- [Audit Log 测试](#audit-log-测试)
- [Migration 测试](#migration-测试)
- [必须运行的命令](#必须运行的命令)
- [验收要求](#验收要求)
- [禁止测试方式](#禁止测试方式)
- [验收报告格式](#验收报告格式)

## 使用场景

以下修改必须执行本矩阵中的相关测试：

- 登录
- logout
- Session
- Cookie
- User status
- Tenant status
- Membership
- Role
- Permission
- 管理后台页面
- 管理后台 API
- PII
- Owner
- MFA
- 密码
- Audit
- Identity Schema
- Identity Migration

同时必须遵守：

- `identity-tenant-rbac`
- `tenant-isolation`
- `testing-validation`

## 测试环境要求

所有数据库和 HTTP 集成测试必须使用：

`本地 Cloudflare D1`

禁止连接远程生产 D1。

禁止复制真实生产客户数据到测试数据库。

测试数据必须使用人工生成的非真实数据。

测试环境至少准备两个 Tenant：

- `qianlin-travel`
- `yunnan-demo`

测试 Membership 至少覆盖：

- viewer
- editor
- admin
- owner

必须存在一个测试 User 在两个 Tenant 中拥有不同 Role。

例如：

- Tenant A = owner
- Tenant B = viewer

测试不得使用：

- 真实密码
- 真实 Session Token
- 真实 MFA Secret
- 真实 Recovery Code
- 真实客户 PII

## 当前项目已经实现

当前关键身份表：

- `users`
- `tenant_memberships`
- `sessions`
- `admin_audit_logs`

当前关键授权入口：

- `requireAdminSession()`
- `requireAdminAccess()`
- `getAdminPageAccess()`

测试必须验证最终：

- HTTP 行为
- Response Body
- 数据库结果
- Audit Log

不能只断言某个 Helper 返回 Boolean。

## 当前生产限制

当前生产后台只允许：

`qianlin-travel`

必须存在测试确认：

即使其他 Tenant 满足：

- Tenant active
- User active
- Membership active
- Role valid

当前生产策略仍拒绝其后台访问。

## HTTP 状态语义

以下状态作为默认测试语义。

### 401

用于未通过身份认证：

- Session 缺失
- Session 无效
- Session 过期
- Session revoked
- Token 被篡改
- User 身份已不可用

### 403

用于身份存在但授权失败：

- Permission 不足
- Membership suspended
- Membership revoked
- MFA 未满足
- 当前生产 Tenant Policy 拒绝
- admin 尝试 Owner 操作

### 404

用于需要隐藏其他 Tenant Resource 是否存在的跨 Tenant Resource 请求。

### 409

用于明确状态冲突：

- 最后一个 active Owner 保护
- 并发 Membership 状态冲突
- 重复 Membership

如果现有 API 已定义更严格统一的状态规范，应保持项目规范，但不得通过错误差异泄露其他 Tenant Resource 是否存在。

## Authentication 测试

| ID | 测试场景 | 前置身份和数据 | 请求或操作 | 预期 HTTP | 预期响应 | 预期数据库结果 | 预期 Audit |
|---|---|---|---|---:|---|---|---|
| AUTH-01 | 正确登录 | active User + 正确密码 | 调用登录接口 | 200 | 登录成功，不返回密码或 Hash | 创建新 Session | 按现有登录审计策略 |
| AUTH-02 | 错误密码 | active User | 错误密码登录 | 401 | 通用认证失败 | 不创建有效 Session | 不记录密码 |
| AUTH-03 | User 不存在 | 无对应 User | 登录 | 401 | 与错误密码保持统一失败语义 | 不创建 Session | 不泄露 User 是否存在 |
| AUTH-04 | suspended User 登录 | User suspended | 正确密码登录 | 401 | 拒绝 | 不创建有效 Session | 不含凭据 |
| AUTH-05 | disabled User 登录 | User disabled | 正确密码登录 | 401 | 拒绝 | 不创建有效 Session | 不含凭据 |

## Session 测试

| ID | 测试场景 | 前置身份和数据 | 请求或操作 | 预期 HTTP | 预期响应 | 预期数据库结果 | 预期 Audit |
|---|---|---|---|---:|---|---|---|
| SES-01 | Session 缺失 | 无 Cookie | 请求受保护 API | 401 | 不返回受保护数据 | 无业务写入 | 无 |
| SES-02 | Session 过期 | `expires_at` 已过期 | 请求受保护 API | 401 | 拒绝 | 业务数据不变化 | 无 |
| SES-03 | Session revoked | `revoked_at` 非空 | 请求受保护 API | 401 | 拒绝 | 业务数据不变化 | 无 |
| SES-04 | Token 被篡改 | 有效 Session，但修改 Cookie Token | 请求受保护 API | 401 | 拒绝 | 不创建替代 Session | 无 |
| SES-05 | 随机 Token | 无对应 token_hash | 请求受保护 API | 401 | 拒绝 | 无变化 | 无 |
| SES-06 | Logout | 有效 Session | logout 后再次请求 | 401 | 第二次请求拒绝 | Session revoked 或等效失效 | 按当前策略 |
| SES-07 | 密码修改撤销 Session | 有效 User + Session | 修改密码后使用旧 Session | 401 | 旧 Session 拒绝 | 旧 Session revoked | 必须有安全 Audit |
| SES-08 | Session Fixation | 登录前存在旧 Cookie | 正确登录 | 200 | 返回新的认证 Cookie | 创建新的 Session | 不记录 Token |

SES-08 必须确认登录后的 Token 与登录前旧 Token 不相同。

## User 与 Membership 状态测试

| ID | 测试场景 | 前置身份和数据 | 请求或操作 | 预期 HTTP | 预期响应 | 预期数据库结果 | 预期 Audit |
|---|---|---|---|---:|---|---|---|
| MEM-01 | Membership missing | User active，无目标 Tenant Membership | 请求后台 API | 403 | 拒绝 | 无写入 | 无 |
| MEM-02 | Membership suspended | Session 有效 + Membership suspended | 请求后台 API | 403 | 拒绝 | 无业务写入 | 无 |
| MEM-03 | Membership revoked | Session 有效 + Membership revoked | 请求后台 API | 403 | 拒绝 | 无业务写入 | 无 |
| MEM-04 | Tenant inactive | Membership active + Tenant 非 active | 请求后台 API | 403 | 拒绝 | 无写入 | 无 |
| MEM-05 | User suspended after login | 先创建有效 Session，再 suspend User | 请求后台 API | 401 | 拒绝 | 无写入 | 无 |
| MEM-06 | User disabled after login | 先创建有效 Session，再 disable User | 请求后台 API | 401 | 拒绝 | 无写入 | 无 |
| MEM-07 | Suspend 立即生效 | active Membership | Suspend 后使用原 Session | 403 | 立即拒绝 | Membership suspended | 必须有 Audit |
| MEM-08 | Revoke 立即生效 | active Membership | Revoke 后使用原 Session | 403 | 立即拒绝 | Membership revoked | 必须有 Audit |

## Role / Permission 测试

| ID | 测试场景 | 前置身份和数据 | 请求或操作 | 预期 HTTP | 预期响应 | 预期数据库结果 | 预期 Audit |
|---|---|---|---|---:|---|---|---|
| RBAC-01 | viewer 读取 Dashboard | viewer active | Dashboard read | 200 | 返回允许数据 | 无写入 | 无 |
| RBAC-02 | viewer 修改 Tour | viewer active | Tour update | 403 | 拒绝 | Tour 不变化 | 无成功 Audit |
| RBAC-03 | editor 修改 Tour | editor active | Tour update | 200 | 成功 | 当前 Tenant Tour 更新 | 按业务策略 |
| RBAC-04 | editor 删除 Tour | editor active | Tour delete | 403 | 拒绝 | Tour 不删除 | 无成功 Audit |
| RBAC-05 | admin 删除普通资源 | admin active | 合法 delete | 200 | 成功 | 当前 Tenant Resource 更新或删除 | 按业务策略 |
| RBAC-06 | viewer 管理成员 | viewer active | member update | 403 | 拒绝 | Membership 不变化 | 无 |
| RBAC-07 | editor 管理成员 | editor active | member update | 403 | 拒绝 | Membership 不变化 | 无 |
| RBAC-08 | admin 管理普通 viewer | admin active + target viewer | 合法 Role update | 200 | 成功 | Target Role 更新 | 必须有 Audit |
| RBAC-09 | 未知 Role | Membership 使用未知测试 Role | 请求受保护 API | 403 | 拒绝 | 无业务写入 | 无 |

## PII 脱敏测试

| ID | 测试场景 | 前置身份和数据 | 请求或操作 | 预期 HTTP | 预期响应 | 预期数据库结果 | 预期 Audit |
|---|---|---|---|---:|---|---|---|
| PII-01 | viewer 查询咨询列表 | viewer active + 测试咨询 | list inquiries | 200 | phone/wechat/email 脱敏或不返回 | 无变化 | 无 |
| PII-02 | viewer 请求完整咨询 | viewer active | sensitive inquiry read | 403 | 不返回完整 PII | 无变化 | 无 |
| PII-03 | editor 读取完整咨询 | editor active | sensitive inquiry read | 200 | 返回授权字段 | 无变化 | 按敏感读取策略 |
| PII-04 | viewer 使用 Search | viewer active | search inquiries | 200 | 结果仍然脱敏 | 无变化 | 无 |
| PII-05 | viewer 页面数据泄露检查 | viewer active | 打开咨询页面 | 200 | HTML/JSON/hydration 无完整 PII | 无变化 | 无 |
| PII-06 | 页面与 API 一致 | viewer active | 页面 + 对应 API | 200 | 两者均为 masked 语义 | 无变化 | 无 |

PII 测试必须检查原始 HTTP Response Body。

不能只检查浏览器最终显示结果。

## 跨 Tenant 测试

| ID | 测试场景 | 前置身份和数据 | 请求或操作 | 预期 HTTP | 预期响应 | 预期数据库结果 | 预期 Audit |
|---|---|---|---|---:|---|---|---|
| TEN-01 | Tenant A User 读取 Tenant B Resource | Tenant A Membership active | 使用 Tenant B Resource ID | 404 | 不泄露存在性 | 无变化 | 无 |
| TEN-02 | Tenant A User 修改 Tenant B Resource | Tenant A editor/admin | Update Tenant B ID | 404 | 拒绝 | Tenant B 不变化 | 无成功 Audit |
| TEN-03 | Tenant A User 删除 Tenant B Resource | Tenant A admin | Delete Tenant B ID | 404 | 拒绝 | Tenant B 不变化 | 无成功 Audit |
| TEN-04 | 伪造 body.tenantId | Tenant A User | body 指向 Tenant B | 400/403 | 不提权 | 不产生跨 Tenant 写入 | 无 |
| TEN-05 | 伪造 tenantSlug | Tenant A User | 请求 Tenant B slug | 403 | 无 Membership 时拒绝 | 无变化 | 无 |
| TEN-06 | 伪造 X-Tenant-ID | Tenant A User | Header 指向 Tenant B | 403 | Header 不产生授权 | 无变化 | 无 |
| TEN-07 | 伪造 Role Header | viewer | Header 填 owner | 403 | Role Header 无效 | 无变化 | 无 |
| TEN-08 | 伪造 body.role | viewer | body.role=owner | 403 | 不提权 | Membership 不变化 | 无 |
| TEN-09 | 同一 User 不同 Tenant Role | A=owner，B=viewer | 在 B 执行 editor 写操作 | 403 | 只能获得 B viewer 权限 | Tenant B 不变化 | 无 |
| TEN-10 | 同一 User 不同 Tenant Role 读取 | A=owner，B=viewer | 在 B 执行 viewer read | 200 | 只返回 B viewer 可读数据 | 无变化 | 无 |
| TEN-11 | 当前生产 Tenant Policy | 非 qianlin-travel Membership active | 请求生产后台 | 403 | 当前生产策略拒绝 | 无变化 | 无 |

如果 API Schema 明确禁止客户端提交 Tenant 字段，TEN-04 应断言 `400`。

如果字段存在但不能参与授权，则断言 `403`。

项目必须保持统一行为。

## Owner 保护测试

| ID | 测试场景 | 前置身份和数据 | 请求或操作 | 预期 HTTP | 预期响应 | 预期数据库结果 | 预期 Audit |
|---|---|---|---|---:|---|---|---|
| OWN-01 | admin 修改 Owner Role | admin + active owner | Role update Owner | 403 | 拒绝 | Owner 不变化 | 可记录失败 |
| OWN-02 | admin Revoke Owner | admin + active owner | Revoke Owner | 403 | 拒绝 | Owner active | 无成功 Audit |
| OWN-03 | admin 把自己提升 Owner | admin | self role -> owner | 403 | 拒绝 | Role 不变化 | 无成功 Audit |
| OWN-04 | 最后一个 Owner 降级 | 仅 1 active owner | owner -> admin | 409 | 保护冲突 | Owner 不变化 | 失败 Audit |
| OWN-05 | 最后一个 Owner Suspend | 仅 1 active owner | Suspend Owner | 409 | 保护冲突 | Owner active | 失败 Audit |
| OWN-06 | 最后一个 Owner Revoke | 仅 1 active owner | Revoke Owner | 409 | 保护冲突 | Owner active | 失败 Audit |
| OWN-07 | 多 Owner 合法变更 | 至少 2 active owners | 降级其中一个 | 200 | 成功 | 至少保留 1 active owner | 必须有 Audit |
| OWN-08 | Owner 转移 | 当前 Owner + active target | 正式 Owner Transfer | 200 | 成功 | Owner 状态符合设计 | 必须有 Audit |
| OWN-09 | 并发 Owner 保护 | 2 active owners | 并发降级两个 Owner | 200 + 409 或等效 | 最终不能为 0 Owner | 至少 1 active owner | 成功/失败按规则审计 |

## MFA 测试

只有任务涉及 MFA 或生产高权限认证时执行 MFA 专项测试。

| ID | 测试场景 | 前置身份和数据 | 请求或操作 | 预期 HTTP | 预期响应 | 预期数据库结果 | 预期 Audit |
|---|---|---|---|---:|---|---|---|
| MFA-01 | owner 未完成 MFA | owner 已认证但 MFA 未验证 | 高风险操作 | 403 | 要求 MFA | 无业务写入 | 无成功 Audit |
| MFA-02 | admin 未完成 MFA | admin 已认证但 MFA 未验证 | 高风险操作 | 403 | 要求 MFA | 无业务写入 | 无成功 Audit |
| MFA-03 | MFA Challenge 正确 | Valid Challenge | 正确验证 | 200 | Challenge 成功 | Challenge 被消费 | 安全 Audit |
| MFA-04 | MFA Challenge 重放 | Challenge 已成功使用 | 再次验证 | 403 | 拒绝 | Challenge 不恢复 | 可记录失败 |
| MFA-05 | MFA Challenge 过期 | Challenge 已过期 | 验证 | 403 | 拒绝 | 不认证 | 不记录敏感数据 |
| MFA-06 | 尝试次数超限 | Challenge 达失败上限 | 再次验证 | 403 | Challenge 失效 | 不认证 | 不记录验证码 |
| MFA-07 | MFA Disable | MFA 已启用 | recent auth + MFA 后 disable | 200 | 成功 | MFA 状态改变 | 必须有 Audit |
| MFA-08 | MFA 敏感日志检查 | 完成 MFA 操作 | 检查日志和 Audit | N/A | 无 Secret/Recovery Code | 无敏感泄露 | Audit 不含 Secret |

## Audit Log 测试

以下高风险操作成功后必须确认 `admin_audit_logs` 存在对应记录：

- member invite
- member role change
- member suspend
- member revoke
- owner transfer
- password change
- MFA enable
- MFA disable
- MFA reset

每条 Audit 必须验证：

- `tenant_id` 正确
- `user_id` 正确
- `action` 正确
- `resource_type` 正确
- `resource_id` 正确或明确为空
- `result` 正确
- `created_at` 存在

Audit metadata 必须确认不存在：

- password
- password_hash
- Session Token
- Cookie Token
- MFA Secret
- Recovery Code
- 完整认证凭据

测试只能使用人工生成的测试凭据检查泄露。

不得使用真实凭据。

## Migration 测试

任何 Identity / RBAC Schema 或 Migration 修改必须执行以下测试。

### Fresh Migration

从全新本地 D1 开始执行全部 Migration。

必须验证以下表结构有效：

- `users`
- `tenant_memberships`
- `sessions`
- `admin_audit_logs`

### Incremental Migration

从上一版本本地数据库执行新增 Migration。

必须验证：

- 旧 User 保留
- 旧 Membership 保留
- Tenant 保留
- 不产生重复 Membership
- 不产生空 `tenant_id`
- Role 不被错误修改
- Membership status 不被错误修改
- 不意外扩大权限

### Foreign Key Check

必须执行或等效验证：

`PRAGMA foreign_key_check;`

正常结果必须为：

`0 条错误`

### Membership Unique Check

必须真实验证：

`UNIQUE (tenant_id, user_id)`

尝试创建重复 Membership 必须失败。

## 必须运行的命令

开始测试前必须先读取：

`package.json`

确认当前 script 定义。

Identity / RBAC 高风险修改至少必须运行：

- `npm run lint`
- `npm test`
- `npm run test:integration:local`

如果当前 `npm test` 已不再包含生产 build：

额外运行：

`npm run build`

如果修改数据库 Migration，还必须完成：

- Fresh local D1 migration
- Incremental local D1 migration
- `PRAGMA foreign_key_check`

## 验收要求

完整验证必须满足：

- failed = 0
- skipped = 0

如果任何必须测试被 Skip：

不得报告“完整验证通过”。

如果某项测试当前无法执行：

必须明确报告为：

`未验证`

不得写成：

`PASS`

## 禁止测试方式

禁止使用远程生产 D1。

禁止为了身份或权限测试执行远程生产数据库命令。

禁止复制生产数据库。

禁止使用真实客户 PII。

禁止只通过以下方式证明安全：

- 正则搜索源码
- 搜索 `tenant_id`
- Mock Database
- Mock Session
- Mock HTTP
- 只测试 Helper Function
- 只运行 TypeScript 编译
- 只运行 lint

静态检查可以作为补充。

涉及真实授权边界时不能替代：

`真实本地 HTTP + 本地 D1`

## 验收报告格式

Identity / RBAC 相关任务完成后必须报告：

修改范围：
- 实际修改文件和功能

实际执行：
- npm run lint
- npm test
- npm run test:integration:local
- Migration checks（如适用）

结果：
- passed: 实际数量
- failed: 0
- skipped: 0

安全验证：
- Authentication: PASS / N/A
- Session: PASS / N/A
- Membership: PASS / N/A
- RBAC: PASS / N/A
- PII masking: PASS / N/A
- Cross-tenant: PASS / N/A
- Owner protection: PASS / N/A
- MFA: PASS / N/A
- Audit: PASS / N/A
- Migration: PASS / N/A

未验证：
- 明确列出所有未实际执行的项目

剩余风险：
- 明确列出真实剩余风险

不得把未执行的测试报告为已验证。