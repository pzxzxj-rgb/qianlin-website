# Session / MFA

当任务涉及登录、Cookie、Session、密码修改、Session 撤销、Tenant 选择、recent authentication、MFA、MFA Recovery 或高风险身份验证时，必须读取本文件。

本文件只定义 Session、密码和 MFA 规则。Role、Membership 生命周期和测试矩阵由其他 reference 定义。

## 目录

- [使用场景](#使用场景)
- [当前项目已经实现](#当前项目已经实现)
- [当前生产限制](#当前生产限制)
- [当前 Session 模型](#当前-session-模型)
- [Cookie 安全](#cookie-安全)
- [Session 验证链](#session-验证链)
- [Tenant 选择](#tenant-选择)
- [Session 创建与轮换](#session-创建与轮换)
- [Session 过期和撤销](#session-过期和撤销)
- [User 与 Membership 状态变化](#user-与-membership-状态变化)
- [密码修改](#密码修改)
- [Recent Authentication](#recent-authentication)
- [MFA 生命周期](#mfa-生命周期)
- [MFA Challenge](#mfa-challenge)
- [MFA Secret 与 Recovery Code](#mfa-secret-与-recovery-code)
- [MFA 生产门槛](#mfa-生产门槛)
- [Audit Log](#audit-log)
- [未来建议方案](#未来建议方案)
- [禁止实现](#禁止实现)

## 使用场景

以下修改必须读取本文件：

- 修改 `lib/admin/auth.ts`
- 修改 `lib/admin/mfa.ts`
- 修改登录 API
- 修改 logout
- 修改 Session Cookie
- 修改 Session 创建
- 修改 Session 查询
- 修改 Session revoke
- 修改密码
- 修改 MFA
- 实现 recent authentication
- 实现 Tenant Switch
- 修改高风险账号操作

任何改变身份安全行为的代码修改都必须同时读取：

`references/security-test-matrix.md`

## 当前项目已经实现

当前官方认证模型是：

`Server-side database session`

当前 Session 表：

`sessions`

当前关键字段包括：

- `user_id`
- `token_hash`
- `expires_at`
- `revoked_at`

当前主要认证函数包括：

- `requireAdminSession()`
- `requireAdminAccess()`
- `createAdminSession()`
- `revokeAdminSession()`
- `revokeAllAdminSessions()`

当前管理员 Cookie：

`qianlin_admin_session`

数据库保存 Token Hash。

客户端持有 Cookie Token。

未经明确认证架构任务，不得建立第二套认证系统。

## 当前生产限制

当前生产后台仍然只允许：

`qianlin-travel`

目标架构允许一个 User 拥有多个 Tenant Membership。

但是在以下能力完成并验证前：

- MFA Provider
- owner/admin MFA 强制
- 成员管理
- Owner 保护
- Tenant Switch 安全
- 完整身份和跨 Tenant 测试

其他 Tenant 的生产后台必须拒绝。

## 当前 Session 模型

客户端持有高熵随机 Session Token。

数据库不得保存可以直接用于认证的明文 Token。

数据库必须保存：

`token_hash`

认证流程必须是：

1. 从 HttpOnly Cookie 读取 Token
2. 服务端计算 Token Hash
3. 查询 `sessions.token_hash`
4. 验证 Session 是否有效
5. 验证 User
6. 再继续 Tenant / Membership / Permission 验证

禁止把明文 Session Token：

- 写入数据库
- 写入日志
- 写入 Audit metadata
- 返回给 debug API

Session 主要证明：

`当前请求对应哪个 User`

Session 不得永久证明：

- 当前 Tenant
- 当前 Role
- 当前 Permission
- 当前 Membership 状态

## Cookie 安全

管理员 Session Cookie 至少必须具有：

- `HttpOnly`
- 明确 `Path`
- 明确 `Max-Age` 或 `Expires`
- 明确 `SameSite`

生产环境必须具有：

`Secure`

当前优先保持：

`SameSite=Lax`

除非明确安全架构任务要求改变。

Cookie Token 不得存入：

- localStorage
- sessionStorage
- URL
- query string
- React 持久状态
- 非 HttpOnly 的第二份 Cookie

## Session 验证链

每个受保护请求必须重新验证：

1. Session Token 存在
2. Token Hash 匹配
3. Session 未过期
4. Session 未 revoked
5. User 为 active
6. Target Tenant 为 active
7. Membership 存在
8. Membership 为 active
9. 当前 Role / Permission 允许
10. Resource Tenant 正确

任何一步失败必须：

`DENY`

不得因为 Cookie 存在就认为 Session 有效。

## Tenant 选择

禁止使用“第一条 Membership”自动决定当前 Tenant。

不得在没有明确 Tenant 选择规则时使用：

- `rows[0]`
- 第一条无排序结果
- 任意 `find()` 命中的 Membership

作为最终 Tenant 授权依据。

当前生产阶段必须显式满足：

`target tenant == qianlin-travel`

并重新验证对应 Membership。

未来 Tenant Switcher 的正确流程：

1. 客户端表达 requested Tenant
2. 服务端解析 Tenant
3. 验证 Tenant active
4. 查询当前 User 对该 Tenant 的 Membership
5. 验证 Membership active
6. 建立可信 Tenant Context

客户端选择 Tenant 只是请求意图，不是授权证明。

即使未来使用：

`X-Tenant-ID`

也只能表示 requested Tenant。

## Session 创建与轮换

登录成功后必须创建新的高熵 Session Token。

不得复用登录前已有的 Session Token。

登录成功后必须：

1. 创建新的 Session
2. 创建新的随机 Token
3. 数据库保存 Token Hash
4. 返回新的 HttpOnly Cookie

如果存在预登录 Session：

成功认证后必须废弃或轮换。

禁止登录成功后继续使用客户端预先提供的 Session ID。

必须防止 Session Fixation。

## Session 过期和撤销

Session 必须检查：

- `expires_at`
- `revoked_at`

以下 Session 必须拒绝：

- 已过期
- 已 revoked
- Token Hash 不匹配
- Token 被篡改
- User 不存在
- User 非 active

logout 后：

服务端 Session 必须 revoked 或等效失效。

只清除浏览器 Cookie 不足以替代服务端 Session revoke。

## User 与 Membership 状态变化

User 被：

- suspended
- disabled

后，即使已有 Session 未过期，也不得继续授权。

Membership 被：

- suspended
- revoked

后，对应 Tenant 权限必须立即失效。

不得等待 Session 自然过期。

单个 Tenant Membership 状态变化不应自动撤销 User 在其他 Tenant 的有效 Membership。

## 密码修改

密码修改必须：

1. 验证当前 Session
2. 验证当前密码或有效 recent authentication
3. 使用项目当前正式 Password Hash 方案
4. 更新 password hash
5. 撤销已有 Session
6. 要求重新认证
7. 写 Audit Log

不得记录：

- 明文密码
- Password Hash
- 当前 Session Token

当前已经存在：

`revokeAllAdminSessions()`

时必须优先复用。

不得创建第二套 Session revoke 实现。

密码修改成功后，旧 Session 再访问受保护 API 必须失败。

## Recent Authentication

以下操作必须要求 recent authentication：

- 修改密码
- MFA disable
- MFA reset
- Owner 转移
- 高风险账号安全设置
- 未来 API Secret 管理

如果当前项目尚未实现 recent authentication：

不得伪造：

`recentAuth = true`

不得信任客户端提交的 recent-auth 时间。

未来正式实现时，服务端 recent authentication 默认有效窗口：

`10 分钟`

时间必须由服务端产生、保存或可信验证。

超过窗口必须重新验证身份。

## MFA 生命周期

MFA 必须明确区分：

- enable
- verify
- disable
- reset
- recover

MFA Enable 必须：

1. Session valid
2. User active
3. recent authentication 有效
4. 创建安全 Enrollment
5. 用户完成 Challenge
6. Challenge 验证成功
7. 才把 MFA 标记为有效
8. 写 Audit Log

不得因为生成 MFA Secret 就直接把 MFA 标记为 enabled。

MFA Disable 必须：

1. Session valid
2. User active
3. recent authentication 有效
4. 当前 MFA 验证通过，或进入正式 Recovery 流程
5. Disable MFA
6. 重新评估或撤销高权限 Session
7. 写 Audit Log

MFA Reset 和 Recovery 必须作为高风险操作处理。

## MFA Challenge

MFA Challenge 必须：

- 有服务端有效期
- 一次性消费
- 防重放
- 限制失败尝试次数
- 成功后立即失效
- 达到失败上限后立即失效

如果项目自行管理 Challenge：

默认有效期不得超过：

`5 分钟`

单个 Challenge 最多允许：

`5 次`

失败验证。

超过限制必须重新创建 Challenge。

不得允许无限 MFA 验证尝试。

## MFA Secret 与 Recovery Code

MFA Secret 不得写入：

- 应用日志
- Audit metadata
- HTTP 错误响应
- analytics
- debug output

Recovery Code 必须：

- 高熵随机
- 只展示必要次数
- 不长期明文保存
- 数据库存储不可直接使用的安全表示
- 使用后立即失效
- 不进入日志

如果当前基础设施无法安全保存自建 MFA Secret：

不得为了完成任务直接使用普通明文字段存储。

必须使用正式 MFA Provider 或明确批准的安全存储方案。

## MFA 生产门槛

生产环境中的：

- owner
- admin

必须完成 MFA。

如果 MFA Provider 尚未正式接入并完成可信验证：

`不得开放其他 Tenant 的生产后台`

当前：

`qianlin-travel`

仍是唯一允许使用生产后台的 Tenant。

不得通过以下方式绕过 MFA：

- 环境变量用户名
- 特殊用户名
- debug 参数
- 开发 Header
- 客户端 Role
- 客户端 MFA 标记

MFA 不能代替：

- Session
- Membership
- Role
- Permission
- Tenant Isolation

## Audit Log

以下操作必须写入 `admin_audit_logs`：

- password change
- revoke all sessions
- MFA enable
- MFA disable
- MFA reset
- MFA recovery
- Owner 转移相关身份验证

Audit 不得包含：

- Session Token
- Password
- Password Hash
- MFA Secret
- Recovery Code
- Challenge Secret
- 完整认证凭据

高风险操作 Audit 失败不得静默吞掉。

## 未来建议方案

未经明确认证架构任务，不得引入：

- JWT access token
- refresh token
- localStorage auth token
- 第二套 Cookie Session

未来如果明确需要 JWT、OAuth 或 API Token，必须先说明：

- 为什么现有 Session 不满足
- Token 生命周期
- revoke 机制
- Tenant 绑定策略
- Permission 策略
- Migration 影响
- 测试要求
- 与现有 Session 的兼容策略

普通功能任务不得顺手引入第二套认证模型。

## 禁止实现

禁止：

- 数据库保存明文 Session Token
- localStorage 保存 Admin Token
- Session 只检查 Cookie 不检查数据库
- Session 不检查 `expires_at`
- Session 不检查 `revoked_at`
- Membership suspended 后继续授权
- User disabled 后继续授权
- 自动使用第一条 Membership 作为当前 Tenant
- 登录成功后复用旧 Session Token
- 密码修改后旧 Session 继续有效
- 客户端控制 recent authentication
- 无限 MFA Challenge 尝试
- MFA Secret 写日志
- Recovery Code 明文长期保存
- 未经架构任务引入 JWT
- 创建第二套 Admin 认证系统