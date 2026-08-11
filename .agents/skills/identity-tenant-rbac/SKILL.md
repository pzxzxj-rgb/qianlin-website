---
name: identity-tenant-rbac
description: 用于 qianlin-website 中涉及用户身份、管理员登录、Session、Cookie、Tenant Membership、角色权限、成员管理、密码修改、MFA、敏感个人信息访问、脱敏和审计日志的任务。必须确保授权建立在有效 User、Session、Tenant 和 Membership 之上，并同时遵守当前生产租户限制。纯样式、纯文案或完全不涉及身份与权限的修改不应触发本 Skill。
---

# Identity / Tenant / RBAC

## 1. 目标

本 Skill 定义 `qianlin-website` 的身份、Tenant Membership 和 RBAC 核心约束。

核心安全公式：

`Authentication + Tenant Membership + RBAC + Tenant Isolation = Authorized Access`

任何必要条件失败：

`DENY`

本 Skill 不保存完整权限矩阵、Membership 生命周期、Session/MFA 细节或测试矩阵。

这些内容按任务需要从 `references/` 渐进加载。

## 2. 规则优先级

身份和权限任务发生冲突时，按以下优先级处理：

1. 身份与权限安全
2. Tenant Isolation
3. 数据完整性
4. Session 与账号安全
5. 当前生产限制
6. Audit
7. 测试完整性
8. 架构一致性
9. 开发便利性

不得为了减少代码、快速上线、通过测试或保持旧行为而降低身份或权限要求。

## 3. 当前项目固定事实

当前项目主要使用：

- Next.js
- Vinext
- React
- TypeScript
- Cloudflare Workers
- Cloudflare D1
- Drizzle ORM

当前身份相关数据模型已经存在：

- `users`
- `tenant_memberships`
- `sessions`
- `admin_audit_logs`

当前合法角色：

- `owner`
- `admin`
- `editor`
- `viewer`

当前身份和后台授权代码主要位于：

- `db/schema.ts`
- `lib/admin/auth.ts`
- `lib/admin/mfa.ts`
- `lib/admin/pageAccess.ts`
- `lib/admin/`
- `lib/tenancy/`

当前主要授权入口包括：

- `requireAdminSession()`
- `requireAdminAccess()`
- `getAdminPageAccess()`
- `AdminAccessContext`

处理相关任务时必须先检查现有实现，不得根据通用 SaaS 教程重新建立第二套体系。

## 4. Tenant 是当前组织权限边界

当前项目没有独立 `organizations` 数据模型。

当前架构中：

`Tenant = 组织权限边界`

因此不得因为实现 RBAC、成员管理或 SaaS 功能而自动新增：

- `organizations`
- `organization_members`
- `organization_roles`

只有明确的架构迁移任务才能讨论独立 Organization 模型。

## 5. 目标架构与当前生产限制必须分开

### 5.1 目标架构

长期架构允许：

`一个 User -> 多个 Tenant Membership`

同一个 User 可以在不同 Tenant 中拥有不同 Role。

例如：

- Tenant A -> owner
- Tenant B -> editor
- Tenant C -> viewer

Role 属于 Membership，不属于 User。

### 5.2 当前生产限制

目标架构支持多个 Membership，不代表当前生产后台已经向多个 Tenant 开放。

当前生产后台仍然只允许：

`qianlin-travel`

在以下能力完成并验证前，不得向其他 Tenant 开放生产后台：

- MFA Provider
- owner/admin MFA 强制
- 成员管理
- Owner 保护
- Tenant 切换安全
- 敏感咨询信息权限
- 高风险 Audit
- 完整 RBAC 测试
- 完整跨 Tenant 权限测试

不得仅通过修改：

- Session 中的 Tenant
- `tenantSlug`
- `X-Tenant-ID`
- Membership 数据

就宣称生产后台已经支持多个 Tenant。

## 6. 核心身份模型

项目必须保持：

`User -> Session`

以及：

`User + Tenant -> TenantMembership -> Role`

必须满足：

- User 不等于 Tenant
- User 不等于 Role
- Session 不等于 Permission
- Role 属于 Membership
- Membership 属于 User + Tenant

禁止把 Tenant 或 Role 重新塞回 User 作为唯一授权来源。

未经明确架构任务，不得新增：

- `users.tenant_id`
- `users.role`
- `users.organization_id`

作为正式 Tenant 或 Role 来源。

## 7. User

`users` 表表示平台级身份。

User 可以负责：

- username
- password hash
- display name
- account status
- identity security

User 不负责：

- 当前 Tenant 权限
- Tenant 内 Role
- Tenant 内 Permission
- Tenant 内资源范围
- Tenant Subscription / Entitlement

禁止通过类似：

`user.role`

或：

`user.tenantId`

执行 Tenant 授权。

## 8. TenantMembership

`tenant_memberships` 是 User 与 Tenant 之间的正式授权关系。

必须保持：

`UNIQUE (tenant_id, user_id)`

正式授权必须同时绑定：

`user_id + tenant_id`

不得只通过 `user_id` 读取任意一条 Membership 后进行授权。

Membership 当前合法状态：

- `active`
- `suspended`
- `revoked`

只有：

`active`

Membership 可以继续进入 Role / Permission 判断。

Membership 生命周期详细规则必须读取：

`references/membership-lifecycle.md`

## 9. User、Tenant、Membership 都必须有效

受保护访问至少必须同时满足：

- Session valid
- User active
- Tenant active
- Membership exists
- Membership active
- Role / Permission allowed
- Resource belongs to Tenant
- Current Production Tenant Policy allowed

任何一步失败必须拒绝。

User 被 suspended 或 disabled 时：

所有 Tenant 后台访问必须拒绝。

Membership 被 suspended 或 revoked 时：

对应 Tenant 权限必须立即失效。

不得等待 Session 自然过期。

## 10. Session 官方模型

当前官方认证模型为：

`Server-side database session`

当前 Session 使用：

`sessions`

数据库保存：

`token_hash`

客户端保存：

HttpOnly Cookie Token

未经明确认证架构任务，不得自动新增：

- JWT access token
- refresh token
- localStorage auth token
- 第二套 Cookie Session
- 第二套 Admin Auth
- OAuth Session replacement

Session、Cookie、密码和 MFA 的详细规则必须读取：

`references/session-mfa.md`

## 11. Session 只证明身份

Session 的主要职责是证明：

`当前请求对应哪个 User`

Session 不得永久证明：

- 当前 Tenant
- 当前 Role
- 当前 Permission
- 当前 Membership 状态

受保护请求必须重新建立完整授权链：

`Session -> User -> Target Tenant -> Membership -> Role/Permission -> Resource Tenant`

不得仅依赖：

- `session.tenantId`
- `session.tenantSlug`
- `session.role`

完成最终授权。

## 12. Tenant 选择不是授权

客户端可以表达：

`requested Tenant`

但客户端不能决定：

`authorized Tenant`

以下信息只能表达目标 Tenant，不能作为权限证明：

- URL `tenantSlug`
- Tenant Switcher
- `X-Tenant-ID`
- 表单 Tenant 字段

服务端必须重新验证：

- 当前 User
- Target Tenant
- 当前 User 对 Target Tenant 的 Membership
- Membership status
- 当前 Role / Permission

不得自动使用数据库返回的第一条无排序 Membership 作为当前 Tenant。

## 13. 当前 Role 模型

当前合法角色只有：

- `viewer`
- `editor`
- `admin`
- `owner`

简单等级关系：

`viewer < editor < admin < owner`

未知 Role：

`DENY`

不得自动把未知 Role 映射为 `admin`。

当前可以继续使用类似：

`requireAdminAccess(request, tenantSlug, "editor")`

表达严格等级型最低 Role。

但复杂业务能力不得只依赖 Role Rank。

## 14. 当前 Permission 模型

当前项目尚未建立完整数据库 Permission 表。

当前正式授权方案是：

`Role Rank + Central Permission Mapping`

未经明确架构任务，不得自动创建：

- `permissions`
- `role_permissions`
- `custom_roles`
- `user_permissions`
- 其他重复 Permission 数据表

业务代码不得散落新的 Role 判断。

当出现业务级权限时，应复用统一 Permission Mapping。

角色与 Permission 的完整定义必须读取：

`references/role-permission-matrix.md`

## 15. 默认拒绝

RBAC 必须：

`deny by default`

以下情况必须拒绝：

- Role 缺失
- Role 非法
- Permission 未定义
- Permission 没有授权给当前 Role
- Membership 不存在
- Membership 非 active
- User 非 active
- Tenant 非 active
- Session 无效
- 当前生产 Tenant 不允许访问
- Resource 不属于可信 Tenant

不得自动回退为：

- viewer
- editor
- admin

## 16. 后端是最终权限边界

前端隐藏按钮、页面元素或字段只属于 UX。

真正安全边界必须位于服务端。

禁止出现：

`UI 拒绝，但 API 允许`

页面和 API 必须共享同一 Permission 语义。

不得在 React 页面或组件中维护第二套 Role / Permission Matrix。

## 17. Permission 通过后仍必须检查 Tenant

RBAC Permission 通过不代表可以访问任意 Tenant 的 Resource。

完整条件始终包含：

`Permission allowed + Resource belongs to trusted Tenant`

Tenant A 的 owner 不能访问 Tenant B 的私有 Resource。

Resource Tenant 详细规则以：

`tenant-isolation`

Skill 为准。

## 18. 敏感咨询信息

咨询数据必须至少区分：

- `inquiry:list_masked`
- `inquiry:read_sensitive`
- `inquiry:update`

viewer 只能读取脱敏咨询信息。

viewer 不得获得完整：

- phone
- wechat
- email
- 其他可直接识别客户身份的数据

不得只在页面层脱敏。

API、页面、Server Component、Search、Export 等路径必须保持相同权限语义。

完整规则读取：

`references/role-permission-matrix.md`

## 19. Owner 不是超级账号

owner 是 Tenant 内最高业务角色，但仍然必须遵守：

- Session validation
- User status
- Tenant status
- Membership status
- MFA
- Tenant Isolation
- Owner protection
- Audit
- 当前生产限制

不得因为 Role 是 owner 就绕过安全检查。

## 20. Admin 与 Owner 必须分开

admin 可以管理被明确授权的普通成员。

admin 不得：

- 修改 Owner
- 降级 Owner
- Suspend Owner
- Revoke Owner
- 删除 Owner
- 把自己提升为 Owner
- 把其他成员提升为 Owner
- 转移 Owner

Owner 管理必须经过独立高风险流程。

详细规则读取：

`references/membership-lifecycle.md`

和：

`references/role-permission-matrix.md`

## 21. 最后一个 Owner 保护

每个正式可管理 Tenant 必须至少保留：

`1 个 active owner`

最后一个 active Owner 不得：

- 被降级
- 被 Suspend
- 被 Revoke
- 被删除
- 自己退出

Owner 转移必须作为独立高风险操作处理。

不得通过两个普通 Role 修改请求模拟 Owner 转移。

## 22. MFA 是生产门槛

生产环境中的：

- owner
- admin

必须完成 MFA。

MFA Provider 尚未正式接入并经过验证时：

`不得开放其他 Tenant 的生产后台`

MFA 不能代替：

- Session
- Membership
- Role
- Permission
- Tenant Isolation

MFA 详细规则读取：

`references/session-mfa.md`

## 23. 密码与 Session

密码属于 User 级身份安全。

密码修改后必须撤销旧 Session。

当前已有：

`revokeAllAdminSessions()`

时必须优先复用。

不得建立第二套 Session revoke 机制。

密码、Session Rotation、recent authentication 的详细要求读取：

`references/session-mfa.md`

## 24. Audit Log

当前项目使用：

`admin_audit_logs`

以下高风险操作必须 Audit：

- 成员邀请
- Role 修改
- Membership Suspend
- Membership Resume
- Membership Revoke
- Owner 转移
- Password 修改
- MFA enable
- MFA disable
- MFA reset
- MFA recovery
- 高风险安全设置修改

Audit 不得包含：

- Password
- Password Hash
- Session Token
- Invitation Token
- MFA Secret
- Recovery Code
- 完整认证凭据
- 客户真实 PII

高风险操作的 Audit 失败不得静默吞掉。

禁止：

`try { await audit() } catch {}`

用于忽略高风险 Audit 失败。

## 25. Platform Admin 与 Tenant Admin

当前项目没有正式 Platform Admin 架构。

不得通过：

- 特殊用户名
- 特殊 Tenant
- 特殊 Cookie
- 环境变量用户名
- debug Header
- query 参数

创建隐藏超级管理员。

不得通过特殊 Tenant Membership 模拟 Platform Admin。

如果未来需要 Platform Admin，必须作为独立架构任务处理。

## 26. Billing 与 RBAC

未来 Billing 必须保持：

`RBAC != Billing Entitlement`

例如 owner 拥有 `billing:manage`，只说明：

`该用户可以管理 Billing`

不代表：

`该 Tenant 自动拥有所有付费功能`

最终业务能力可能同时要求：

`RBAC Permission + Tenant Entitlement`

Billing 详细规则由未来独立 Billing Skill 定义。

## 27. 数据库演进约束

修改身份或权限 Schema 时必须确认：

- User 仍然是平台级身份
- Role 仍属于 Membership
- `(tenant_id, user_id)` 仍然唯一
- Session 仍然安全
- 当前管理员数据兼容
- 当前生产 Tenant 不被破坏
- Migration 不扩大权限
- 旧 Session 是否需要撤销
- 是否需要 Backfill

不得在普通任务中自动创建：

- organizations
- permissions
- role_permissions
- custom_roles
- auth_v2
- rbac_v2
- membership_v2

数据库修改必须同时遵守：

- `tenant-isolation`
- `testing-validation`

## 28. Reference 加载规则

修改角色、Permission、页面/API 授权、敏感咨询访问、Billing、Audit 或 Owner 权限时，必须读取：

`references/role-permission-matrix.md`

修改成员邀请、Membership 状态、Role 变更、Suspend、Resume、Revoke、最后一个 Owner 保护或 Owner 转移时，必须读取：

`references/membership-lifecycle.md`

修改登录、Cookie、Session、密码、Session revoke、Tenant 选择、recent authentication 或 MFA 时，必须读取：

`references/session-mfa.md`

任何会改变身份、权限或安全行为的代码修改，都必须同时读取：

`references/security-test-matrix.md`

不要无条件读取所有 reference。

只读取当前任务需要的领域文件，但安全行为发生变化时 `security-test-matrix.md` 是强制项。

## 29. 与 tenant-isolation 的关系

`identity-tenant-rbac` 负责：

- 当前 User 是谁
- User 是否有效
- 属于哪个 Tenant
- Membership 是否有效
- 当前 Role 是什么
- 是否有 Permission
- 是否满足 MFA
- 是否需要 Audit

`tenant-isolation` 负责：

- 目标 Resource 是否属于正确 Tenant
- 数据库查询是否限制 Tenant
- 是否可能跨 Tenant 读取、修改、删除或关联

两者必须同时满足。

RBAC 不能替代 Tenant Isolation。

Tenant Isolation 也不能替代 RBAC。

## 30. 与 testing-validation 的关系

任何身份、Session、Membership、Role、Permission、PII、Owner 或 MFA 行为变化都必须遵守：

`testing-validation`

并读取：

`references/security-test-matrix.md`

不得只测试正常成功路径。

必须根据任务风险覆盖：

- Authentication failure
- Session failure
- Membership failure
- Role failure
- PII masking
- Cross Tenant
- Owner protection
- MFA
- Audit
- Migration

## 31. Codex 开始任务前

涉及本 Skill 时必须先检查真实代码。

至少检查与任务相关的：

- `db/schema.ts`
- `lib/admin/auth.ts`
- `lib/admin/mfa.ts`
- `lib/admin/pageAccess.ts`
- `lib/admin/`
- `lib/tenancy/`
- 相关 API
- 相关测试
- `package.json`

不得假设 Skill 中记录的函数、Schema 或测试命令永远没有变化。

如果实际项目已经变化：

应以当前代码为事实基础，并明确指出 Skill 是否需要同步更新。

## 32. Codex 实现要求

必须优先复用现有：

- `users`
- `tenant_memberships`
- `sessions`
- `admin_audit_logs`
- `requireAdminSession()`
- `requireAdminAccess()`
- `getAdminPageAccess()`
- `AdminAccessContext`

不得擅自创建：

- `auth_v2`
- `new_auth`
- `jwt_auth`
- `rbac2`
- `new_permissions`
- `organization_users`
- `user_tenants`

如果现有架构确实无法满足需求，必须先说明：

- 当前问题
- 安全风险
- 数据库影响
- Migration 影响
- Session 影响
- 生产影响
- 测试影响
- 是否可以渐进迁移

不得在普通功能任务中偷偷替换身份架构。

## 33. 强制授权流程

受保护后台 API 必须遵循：

1. Request
2. Session Validation
3. User Validation
4. Current Production Tenant Policy
5. Resolve Target Tenant
6. Membership Validation
7. Role / Permission Validation
8. Sensitive Data Policy
9. Resource Tenant Validation
10. Business Logic
11. Required Audit
12. Response

不得从以下信息直接建立授权：

- `body.tenantId`
- `body.role`
- `X-Tenant-ID`
- `X-Role`
- localStorage
- query 参数
- 未验证 Cookie

## 34. 禁止实现

禁止：

- User 保存唯一 Tenant Role
- Session 永久缓存授权结果
- 第一条 Membership 自动成为当前 Tenant
- 未知 Role 自动提权
- viewer 获取完整咨询 PII
- editor 管理成员
- admin 修改 Owner
- admin 自行提升 Owner
- 前端成为唯一权限边界
- Permission 通过后跳过 Tenant 验证
- 当前生产 Tenant 限制被绕过
- owner/admin 绕过生产 MFA
- 静默吞掉高风险 Audit 失败
- 明文日志记录认证凭据
- 普通任务引入 JWT
- 普通任务创建 Permission 数据表
- 创建隐藏超级管理员
- 创建第二套 RBAC
- 创建第二套 Admin Session 系统

## 35. 修改完成检查

完成身份或权限任务前必须确认：

- [ ] User 仍然是平台级身份
- [ ] Role 仍然属于 Tenant Membership
- [ ] `(tenant_id, user_id)` 仍然唯一
- [ ] Session 不是永久授权来源
- [ ] Membership 每次重新验证
- [ ] User 必须 active
- [ ] Tenant 必须 active
- [ ] Membership 必须 active
- [ ] Permission 使用统一语义
- [ ] Resource Tenant 已验证
- [ ] 当前生产只允许 `qianlin-travel`
- [ ] viewer 不会读取完整咨询 PII
- [ ] admin 无法修改 Owner
- [ ] 最后一个 Owner 有保护
- [ ] owner/admin 满足生产 MFA 规则
- [ ] 高风险操作存在安全 Audit
- [ ] 没有创建第二套认证或 RBAC
- [ ] 已读取任务需要的 reference
- [ ] 已执行 `security-test-matrix.md` 中适用测试
- [ ] 已遵守 `tenant-isolation`
- [ ] 已遵守 `testing-validation`

## 36. 最终授权原则

任何受保护操作最终必须能够回答：

1. 当前请求是谁？
2. Session 是否有效？
3. User 是否 active？
4. 请求访问哪个 Tenant？
5. 当前生产是否允许该 Tenant 使用后台？
6. User 是否拥有该 Tenant 的 active Membership？
7. 当前 Role 是否合法？
8. 当前 Permission 是否允许该操作？
9. 是否涉及敏感 PII？
10. owner/admin 是否满足生产 MFA？
11. Resource 是否属于同一 Tenant？
12. 是否属于必须 Audit 的高风险操作？

任何必要答案不满足要求：

`DENY`

不得为了开发便利自动放宽。