import type { UserRole } from "@/app/generated/prisma/client";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/get-session";
import { canAccessWarehouseFeatures, getHomePathForRole } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session-token";

/**
 * 页面层登录兜底：未登录跳转到登录页。
 */
export async function requirePageSession(): Promise<SessionPayload> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * 页面层角色兜底：已登录但角色不匹配时回到各自首页。
 */
export async function requirePageRole(
  roles: UserRole[]
): Promise<SessionPayload> {
  const session = await requirePageSession();
  if (!roles.includes(session.role)) {
    redirect(`${getHomePathForRole(session.role)}?error=forbidden`);
  }
  return session;
}

/**
 * 页面层仓库功能兜底：仅管理员与员工可访问。
 */
export async function requireWarehousePageAccess(): Promise<SessionPayload> {
  const session = await requirePageSession();
  if (!canAccessWarehouseFeatures(session.role)) {
    redirect(`${getHomePathForRole(session.role)}?error=forbidden`);
  }
  return session;
}
