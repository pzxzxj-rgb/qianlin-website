# Role / Permission Matrix

当任务涉及角色判断、Permission、页面访问控制、后台 API 授权、敏感咨询信息读取、成员管理、Tenant 设置、Audit、Billing 或 Owner 权限时，必须读取本文件。

本文件只定义角色与权限规则。Session、MFA、Membership 生命周期和安全测试分别由其他 reference 定义。

## 目录

- [使用场景](#使用场景)
- [当前项目已经实现](#当前项目已经实现)
- [当前生产限制](#当前生产限制)
- [合法角色与默认拒绝](#合法角色与默认拒绝)
- [Role 等级与 Permission](#role-等级与-permission)
- [Permission 命名规范](#permission-命名规范)
- [权限矩阵](#权限矩阵)
- [敏感咨询数据权限](#敏感咨询数据权限)
- [成员与 Owner 权限](#成员与-owner-权限)
- [页面与 API 一致性](#页面与-api-一致性)
- [Resource Tenant 验证](#resource-tenant-验证)
- [未来建议方案](#未来建议方案)
- [禁止实现](#禁止实现)

## 使用场景

以下修改必须读取本文件：

- 修改 `requireAdminAccess()`
- 修改 `getAdminPageAccess()`
- 修改后台页面访问条件
- 修改后台 API 授权
- 修改 `owner/admin/editor/viewer`
- 新增或修改 Permission
- 修改咨询敏感信息访问
- 修改成员管理权限
- 修改 Tenant 设置权限
- 修改 Audit 查看权限
- 修改 Billing 权限
- 修改 Owner 管理逻辑

任何改变权限行为的代码修改都必须同时读取：

`references/security-test-matrix.md`

## 当前项目已经实现

当前合法角色只有：

- `viewer`
- `editor`
- `admin`
- `owner`

角色来源必须是：

`tenant_memberships.role`

Role 属于：

`User + Tenant Membership`

Role 不是 User 的全局属性。

当前授权入口必须优先复用：

- `requireAdminSession()`
- `requireAdminAccess()`
- `getAdminPageAccess()`
- `AdminAccessContext`

当前简单等级关系：

`viewer < editor < admin < owner`

当前授权方案：

`Role 等级 + 集中式 Permission Mapping`

当前项目尚未建立完整的数据库 Permission 模型。

未经明确架构任务，不得创建：

- `permissions`
- `role_permissions`
- `custom_roles`
- 其他重复 Permission 表

## 当前生产限制

目标架构允许一个 User 拥有多个 Tenant Membership，并在不同 Tenant 中拥有不同 Role。

但是当前生产后台仍然只允许：

`qianlin-travel`

Role 或 Permission 验证通过不得绕过当前生产 Tenant 限制。

其他 Tenant 在正式生产开放条件完成前必须拒绝后台访问。

## 合法角色与默认拒绝

合法角色集合固定为：

- `viewer`
- `editor`
- `admin`
- `owner`

授权必须采用：

`deny by default`

以下任一情况必须拒绝：

- Role 缺失
- Role 不属于合法集合
- Permission 未定义
- 当前 Role 没有对应 Permission
- User 非 `active`
- Tenant 非 `active`
- Membership 不存在
- Membership 非 `active`
- Session 无效
- Resource 不属于可信 Tenant
- 当前生产 Tenant Policy 不允许访问

未知角色例如：

- `superadmin`
- `manager`
- `staff`
- `operator`

必须拒绝。

不得自动映射为 `admin` 或任何合法角色。

## Role 等级与 Permission

Role Rank 只用于具有严格等级关系的简单授权。

例如现有：

`requireAdminAccess(request, tenantSlug, "editor")`

可以表达最低 Role 要求。

以下能力不得只依赖 Role Rank，必须经过集中式 Permission Mapping：

- 敏感 PII
- 成员管理
- Owner 管理
- Billing
- Audit
- Tenant 核心设置
- 高风险删除操作

不得假设：

`更高 Role = 自动拥有所有未来功能`

业务代码不得自行重新定义 Role 能力。

## Permission 命名规范

Permission 统一使用：

`resource:action`

当前 Permission 名称：

- `dashboard:read`
- `tour:read`
- `tour:create`
- `tour:update`
- `tour:delete`
- `destination:read`
- `destination:create`
- `destination:update`
- `destination:delete`
- `contact:read`
- `contact:create`
- `contact:update`
- `contact:delete`
- `image:read`
- `image:create`
- `image:update`
- `image:delete`
- `inquiry:list_masked`
- `inquiry:read_sensitive`
- `inquiry:update`
- `member:read`
- `member:invite`
- `member:update`
- `member:remove`
- `role:manage`
- `tenant:settings`
- `audit:read`
- `billing:read`
- `billing:manage`
- `owner:manage`

不得为同一能力创建多个同义 Permission。

例如不得同时存在：

- `tour:edit`
- `tour:update`
- `tour:write`

## 权限矩阵

`✓` = 允许  
`—` = 拒绝  
`✓*` = 允许，但存在额外强制限制

| Permission | viewer | editor | admin | owner |
|---|---:|---:|---:|---:|
| dashboard:read | ✓ | ✓ | ✓ | ✓ |
| tour:read | ✓ | ✓ | ✓ | ✓ |
| tour:create | — | ✓ | ✓ | ✓ |
| tour:update | — | ✓ | ✓ | ✓ |
| tour:delete | — | — | ✓ | ✓ |
| destination:read | ✓ | ✓ | ✓ | ✓ |
| destination:create | — | ✓ | ✓ | ✓ |
| destination:update | — | ✓ | ✓ | ✓ |
| destination:delete | — | — | ✓ | ✓ |
| contact:read | ✓ | ✓ | ✓ | ✓ |
| contact:create | — | ✓ | ✓ | ✓ |
| contact:update | — | ✓ | ✓ | ✓ |
| contact:delete | — | — | ✓ | ✓ |
| image:read | ✓ | ✓ | ✓ | ✓ |
| image:create | — | ✓ | ✓ | ✓ |
| image:update | — | ✓ | ✓ | ✓ |
| image:delete | — | — | ✓ | ✓ |
| inquiry:list_masked | ✓ | ✓ | ✓ | ✓ |
| inquiry:read_sensitive | — | ✓ | ✓ | ✓ |
| inquiry:update | — | ✓ | ✓ | ✓ |
| member:read | — | — | ✓ | ✓ |
| member:invite | — | — | ✓ | ✓ |
| member:update | — | — | ✓ | ✓ |
| member:remove | — | — | ✓ | ✓ |
| role:manage | — | — | ✓* | ✓ |
| tenant:settings | — | — | ✓ | ✓ |
| audit:read | — | — | ✓ | ✓ |
| billing:read | — | — | — | ✓ |
| billing:manage | — | — | — | ✓ |
| owner:manage | — | — | — | ✓ |

`admin` 的 `role:manage` 只允许管理非 Owner Membership。

## 敏感咨询数据权限

咨询权限必须严格区分：

- `inquiry:list_masked`
- `inquiry:read_sensitive`
- `inquiry:update`

viewer 只能拥有：

`inquiry:list_masked`

viewer 返回结果中的以下数据必须脱敏或不返回：

- phone
- wechat
- email
- 其他可以直接识别客户身份的信息

viewer 不得通过以下路径获取完整 PII：

- 列表 API
- Detail API
- Search API
- Export
- 页面 HTML
- Server Component 数据
- hydration 数据
- debug response

editor、admin、owner 可以拥有：

- `inquiry:read_sensitive`
- `inquiry:update`

敏感读取通过 Permission 后仍然必须验证 Tenant。

## 成员与 Owner 权限

viewer 和 editor 不得：

- 查看成员管理数据
- 邀请成员
- 修改 Membership
- 修改 Role
- 移除成员
- 管理 Owner

admin 可以管理普通 Membership。

admin 不得：

- 修改 Owner Role
- Suspend Owner
- Revoke Owner
- 删除 Owner
- 将普通成员提升为 Owner
- 将自己提升为 Owner
- 转移 Owner

Owner 相关操作必须要求：

`owner:manage`

并同时遵守：

- Owner 保护
- MFA
- recent authentication
- Audit Log

owner 不是绕过安全规则的超级账号。

## 页面与 API 一致性

页面和 API 必须共享同一套 Permission 语义。

禁止出现：

`页面对 viewer 脱敏，但 API 返回完整 PII`

禁止出现：

`页面隐藏删除按钮，但 API 允许 viewer 删除`

前端权限只负责 UX。

真正安全边界必须在服务端。

不得在 React 页面或组件中维护第二套独立 Role / Permission Matrix。

## Resource Tenant 验证

Permission 通过后仍然必须验证：

`Resource belongs to trusted Tenant`

Tenant A 的 owner 不能因为拥有高 Role 而访问 Tenant B 的 Resource。

完整授权条件必须包含：

`Permission allowed + Resource Tenant valid`

Resource Tenant 详细规则以 `tenant-isolation` Skill 为准。

## 未来建议方案

未来如果 Permission 数量增加，优先继续扩展集中式 Permission Mapping。

只有明确架构任务要求数据库化 Permission 时，才允许评估：

- `permissions`
- `role_permissions`
- `custom_roles`

在该架构任务完成前，不得自动创建这些表。

未来 Permission 架构仍必须保证：

- Role 属于 Membership
- Tenant 是权限边界
- 未知 Permission 默认拒绝
- 页面与 API 使用同一语义
- Resource Tenant 必须再次验证

## 禁止实现

禁止：

- `users.role`
- `users.tenant_id` 作为唯一权限来源
- 使用客户端传入 Role 授权
- 使用 Header 中 Role 授权
- 使用 localStorage Role 授权
- 未知 Role 自动映射为 admin
- viewer 获取完整咨询 PII
- editor 管理成员
- admin 修改 Owner
- admin 将自己或他人提升为 Owner
- Permission 通过后跳过 Tenant 验证
- 页面与 API 使用不同权限规则
- 为同一能力创建重复 Permission
- 普通任务自动创建 Permission 数据表
- 创建第二套独立 RBAC 实现