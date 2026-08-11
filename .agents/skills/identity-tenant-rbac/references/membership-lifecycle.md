# Membership Lifecycle

当任务涉及 Tenant Membership、成员邀请、成员状态、角色修改、暂停、恢复、撤销、Owner 保护或 Owner 转移时，必须读取本文件。

本文件只定义 `tenant_memberships` 生命周期。角色权限矩阵、Session/MFA 和安全测试由其他 reference 定义。

## 目录

- [使用场景](#使用场景)
- [当前项目已经实现](#当前项目已经实现)
- [当前生产限制](#当前生产限制)
- [Membership 数据约束](#membership-数据约束)
- [状态定义](#状态定义)
- [状态转换矩阵](#状态转换矩阵)
- [统一成员操作验证链](#统一成员操作验证链)
- [成员邀请流程](#成员邀请流程)
- [角色修改规则](#角色修改规则)
- [暂停与恢复](#暂停与恢复)
- [撤销 Membership](#撤销-membership)
- [User 与 Membership 状态区别](#user-与-membership-状态区别)
- [Owner 保护](#owner-保护)
- [Owner 转移](#owner-转移)
- [Session 失效规则](#session-失效规则)
- [事务与并发](#事务与并发)
- [Audit Log](#audit-log)
- [未来建议方案](#未来建议方案)
- [禁止实现](#禁止实现)

## 使用场景

以下任务必须读取本文件：

- 修改 `tenant_memberships`
- 新增成员管理
- 邀请成员
- 接受邀请
- 修改成员 Role
- Suspend Membership
- Resume Membership
- Revoke Membership
- 移除成员
- Owner 转移
- 修改最后一个 Owner 保护
- 修改成员相关 API

任何改变 Membership 行为的代码修改都必须同时读取：

`references/security-test-matrix.md`

## 当前项目已经实现

当前正式成员关系表：

`tenant_memberships`

当前重要字段：

- `tenant_id`
- `user_id`
- `role`
- `status`

当前合法 Role：

- `viewer`
- `editor`
- `admin`
- `owner`

当前合法 Membership 状态：

- `active`
- `suspended`
- `revoked`

当前唯一约束必须保持：

`UNIQUE (tenant_id, user_id)`

Role 必须保存在 Membership 中，不得移动到 `users` 作为全局 Role。

## 当前生产限制

目标架构允许一个 User 拥有多个 Tenant Membership。

但是当前生产后台仍然只允许：

`qianlin-travel`

创建其他 Tenant Membership 不等于已经允许该 Tenant 使用生产后台。

生产开放规则不得由 Membership 创建流程绕过。

## Membership 数据约束

同一个 User 在同一个 Tenant 中只能拥有一条 Membership。

必须保持：

`UNIQUE (tenant_id, user_id)`

Membership 必须同时引用真实：

- User
- Tenant

禁止：

- 同一个 User 在同一 Tenant 存在多条 Membership
- Membership 缺失 `tenant_id`
- Membership 缺失 `user_id`
- Role 为未知值
- status 为未知值
- Role 存储在 User 上代替 Membership

任何 Membership 查询必须同时绑定：

`user_id + tenant_id`

不得只通过 `user_id` 取任意 Membership 进行授权。

## 状态定义

### active

表示该 Membership 当前有效。

只有 `active` Membership 可以继续进入 Role / Permission 验证。

### suspended

表示该 User 暂时失去该 Tenant 的后台权限。

Membership 记录仍然保留。

`suspended` 后下一次受保护请求必须立即拒绝。

### revoked

表示该 Membership 已正式撤销。

`revoked` 是终止状态。

普通恢复功能不得直接执行：

`revoked -> active`

如果未来允许重新加入，必须通过明确的重新加入或邀请流程处理。

## 状态转换矩阵

| From | To | 是否允许 |
|---|---|---:|
| active | suspended | 允许 |
| active | revoked | 允许 |
| suspended | active | 允许 |
| suspended | revoked | 允许 |
| revoked | active | 禁止直接转换 |
| revoked | suspended | 禁止 |
| active | active | 只允许幂等 |
| suspended | suspended | 只允许幂等 |
| revoked | revoked | 只允许幂等 |

每次状态修改前必须重新读取数据库中的当前状态。

不得依赖客户端提交的旧状态。

## 统一成员操作验证链

每个成员操作必须依次验证：

1. Operator Session 有效
2. Operator User 为 `active`
3. Target Tenant 为 `active`
4. Operator Membership 存在
5. Operator Membership 为 `active`
6. Operator 拥有对应 Permission
7. Target Membership 属于同一 Tenant
8. Target Membership 当前状态允许该操作
9. Owner 保护规则成立
10. 执行 Mutation
11. 写入必须的 Audit Log

任何一步失败都不得执行成员写操作。

客户端提交的：

- `tenantId`
- `tenant_id`
- `tenantSlug`
- `role`

都不能作为授权证明。

## 成员邀请流程

当前 `tenant_memberships.status` 不包含：

`invited`

未经明确 Schema 任务，不得为了邀请功能直接增加 `invited` 状态。

未来正式实现邀请时，Invitation 应与正式 Membership 分离。

推荐流程：

1. 创建 Invitation
2. 生成高熵随机 Token
3. 数据库只保存 Token Hash
4. 设置明确过期时间
5. 用户完成身份确认
6. 验证 Invitation 仍有效
7. 创建 `tenant_memberships`
8. 将 Invitation 标记为已使用
9. Invitation Token 立即失效
10. 写 Audit Log

Invitation Token 必须：

- 高熵随机
- 数据库保存 Hash
- 有明确过期时间
- 一次性使用
- 使用后立即失效
- 撤销后立即失效
- 不写入普通日志
- 不写入 Audit metadata
- 不写入错误响应

接受邀请时必须重新验证：

- Tenant 仍 active
- User 身份有效
- Intended Role 仍合法
- Invitation 未过期
- Invitation 未使用
- 不存在重复 Membership

## 角色修改规则

修改 Role 必须验证：

- Operator Session 有效
- Operator User active
- Tenant active
- Operator Membership active
- Operator 拥有 `role:manage` 或更严格 Permission
- Target Membership 属于当前 Tenant
- Target Membership 非 revoked
- Target Role 属于合法 Role 集合

成员不得自行提权。

禁止：

- viewer 把自己提升为 editor
- editor 把自己提升为 admin
- admin 把自己提升为 owner

admin 可以修改普通非 Owner Membership，但不得：

- 修改 Owner Role
- 把普通成员提升为 Owner
- 降级 Owner
- Suspend Owner
- Revoke Owner

Owner 创建和转移必须进入独立 Owner 流程。

## 暂停与恢复

合法暂停：

`active -> suspended`

暂停后必须立即失去该 Tenant 权限。

不得等待 Session 自然过期。

恢复只能执行：

`suspended -> active`

恢复必须重新验证 Operator 的当前权限。

恢复不得自动提升 Role。

恢复后的 Role 必须保持为暂停前合法 Role，除非同时执行经过独立授权的 Role 修改。

## 撤销 Membership

合法撤销：

- `active -> revoked`
- `suspended -> revoked`

撤销后必须立即失去该 Tenant 权限。

不得：

- 等 Session 过期后才生效
- 只在前端隐藏 Tenant
- 继续允许后台 API
- 继续返回当前 Tenant 私有数据

revoked Membership 不得通过普通 Resume 恢复。

## User 与 Membership 状态区别

User 状态表示平台级身份状态。

Membership 状态表示单个 Tenant 中的成员授权状态。

例如：

- User = active
- Tenant A Membership = suspended
- Tenant B Membership = active

结果必须是：

- Tenant A：拒绝
- Tenant B：按 Tenant B Role 正常判断

Suspend 单个 Membership 时，不得自动执行：

`users.status = disabled`

除非任务明确要求平台级封禁 User。

如果 User 被 suspended 或 disabled：

所有 Tenant Membership 都不得产生有效后台权限。

## Owner 保护

每个正式可管理 Tenant 必须至少保留：

`1 个 active owner`

最后一个 active Owner 不得：

- 被降级
- 被 Suspend
- 被 Revoke
- 被删除
- 自己退出
- 把自己修改为非 Owner

任何可能减少 active Owner 数量的操作，都必须在写入前检查当前 active Owner 数量。

禁止：

`先修改，再检查是否还有 Owner`

必须：

`先验证保护条件，再执行写入`

admin 不得修改 Owner。

## Owner 转移

Owner 转移必须是独立高风险操作。

不得通过普通 `role:manage` 或两个普通 Role Update 模拟 Owner 转移。

Owner 转移必须验证：

- Session valid
- Operator User active
- Tenant active
- Operator Membership active
- Operator 当前为 owner
- MFA 满足生产要求
- recent authentication 有效
- Target Membership 属于同一 Tenant
- Target Membership active
- Target User active
- Target Role 合法

Owner 转移必须明确：

- 新 Owner 是谁
- 原 Owner 转移后保留什么 Role

Owner 转移必须写 Audit Log。

## Session 失效规则

Membership 被 `suspended` 或 `revoked` 后：

即使 `sessions` 中 Session 本身仍未过期，下一次授权也必须因为 Membership 非 active 而失败。

权限失效不得依赖 Session 删除。

单 Tenant Membership 状态变化，不得默认撤销 User 在其他 Tenant 的所有权限。

以下情况可以要求撤销全部 User Session：

- 修改密码
- 平台级 User disabled
- 明确账号安全事件
- 用户主动退出全部设备
- 安全策略明确要求

## 事务与并发

以下操作必须考虑并发：

- Role 修改
- Membership Suspend
- Membership Revoke
- 最后一个 Owner 检查
- Owner 转移
- Invitation Accept

必须使用当前 Cloudflare D1 / Drizzle 可提供的原子、事务或批处理能力。

如果无法在单事务完成，必须设计：

- 明确前置条件
- 幂等操作
- 写后验证
- 冲突处理
- 失败恢复

必须防止两个并发请求同时把最后两个 Owner 都降级或撤销。

重复请求不得重复：

- 创建 Membership
- 接受同一 Invitation
- Owner 转移
- 写入冲突角色状态

## Audit Log

以下操作必须写入 `admin_audit_logs`：

- member invite
- invitation revoke
- member suspend
- member resume
- member revoke
- member role change
- owner transfer

Audit 至少必须包含：

- `tenant_id`
- `user_id`
- `action`
- `resource_type`
- `resource_id`
- `result`
- safe metadata
- `created_at`

Audit 不得包含：

- Invitation Token
- Session Token
- Password
- Password Hash
- MFA Secret
- Recovery Code
- 完整认证凭据

高风险成员操作 Audit 失败不得静默忽略。

## 未来建议方案

未来可以增加正式 Invitation 模型。

只有明确架构任务要求时才可以新增对应 Schema。

不得提前创建：

- `organization_members`
- `user_tenants`
- `membership_v2`

当前正式成员关系继续使用：

`tenant_memberships`

未来即使扩展 Membership，也必须保持：

- User 与 Tenant 分离
- Role 属于 Membership
- `(tenant_id, user_id)` 唯一
- 最后一个 Owner 保护
- 状态变化立即影响授权

## 禁止实现

禁止：

- User 直接保存 Tenant Role
- 同一 User 在同一 Tenant 存在多条 Membership
- revoked 直接恢复 active
- admin 修改 Owner
- admin 创建 Owner
- 成员自行提权
- suspended 后继续使用旧 Role 授权
- revoked 后等待 Session 过期
- 删除最后一个 active Owner
- Owner 转移拆成普通 Role 修改
- 客户端 tenantId 决定 Membership Tenant
- 明文保存 Invitation Token
- 日志记录 Invitation Token
- 静默吞掉高风险 Audit 失败