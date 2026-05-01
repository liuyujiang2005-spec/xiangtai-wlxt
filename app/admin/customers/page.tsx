import { redirect } from "next/navigation";

/**
 * 旧路径「客户管理」已并入账号管理，保留重定向以免书签失效。
 */
export default function AdminCustomersRedirectPage() {
  redirect("/admin/accounts");
}
