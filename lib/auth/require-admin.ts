import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/get-session";
import type { SessionPayload } from "@/lib/auth/session-token";

/**
 * 要求当前用户为管理员，否则返回 401/403。
 */
export async function requireAdmin(): Promise<SessionPayload | NextResponse> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    return NextResponse.json({ message: "需要管理员权限" }, { status: 403 });
  }
  return session;
}
