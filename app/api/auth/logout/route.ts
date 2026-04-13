import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth/session-token";

/**
 * 退出登录：清除会话 Cookie。
 */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ message: "已退出登录" });
  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
