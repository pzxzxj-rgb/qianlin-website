export function confirmAdminImageNavigation(isDirty: boolean) {
  return !isDirty || window.confirm("有未保存的图片修改，确定返回后台吗？");
}
