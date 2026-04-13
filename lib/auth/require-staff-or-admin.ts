import { NextResponse } from "next/server";
import { canAccessWarehouseFeatures } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/get-session";
import type { SessionPayload } from "@/lib/auth/session-token";

/**
 * 要求当前请求已登录且为管理员或员工；否则直接返回 401/403 响应。
 */
export async function requireStaffOrAdmin(): Promise<
  SessionPayload | NextResponse
> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }
  if (!canAccessWarehouseFeatures(session.role)) {
    return NextResponse.json({ message: "无权访问" }, { status: 403 });
  }
  return session;
}
