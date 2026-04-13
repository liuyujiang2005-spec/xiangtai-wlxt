import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/get-session";
import { getHomePathForRole } from "@/lib/auth/roles";

/**
 * 根路径根据登录状态跳转到登录页或角色首页。
 */
export default async function Home() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  redirect(getHomePathForRole(session.role));
}
