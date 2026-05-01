import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/get-session";
import type { SessionPayload } from "@/lib/auth/session-token";

/**
 * 要求当前用户为客户角色，否则返回 401/403。
 */
export async function requireClient(): Promise<SessionPayload | NextResponse> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }
  if (session.role !== "CLIENT") {
    return NextResponse.json({ message: "需要客户账号" }, { status: 403 });
  }
  return session;
}
