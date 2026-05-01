import { redirect } from "next/navigation";

/**
 * 旧路径「员工管理」已并入账号管理，保留重定向以免书签失效。
 */
export default function AdminStaffUsersRedirectPage() {
  redirect("/admin/accounts");
}
