import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSecret } from "@/lib/auth/config";
import { getHomePathForRole } from "@/lib/auth/roles";
import {
  getSessionCookieName,
  signSessionToken,
} from "@/lib/auth/session-token";

type LoginBody = {
  username?: string;
  password?: string;
};

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/**
 * 用户登录：校验账号密码并设置 HttpOnly 会话 Cookie。
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as LoginBody;
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";

    if (!username || !password) {
      return NextResponse.json({ message: "请输入账号和密码" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
    }

    if (user.isBanned) {
      return NextResponse.json(
        { message: "该账号已被封禁，无法登录" },
        { status: 403 }
      );
    }

    const passwordOk = await compare(password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
    }

    const token = await signSessionToken(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
      },
      getAuthSecret()
    );

    const response = NextResponse.json({
      message: "登录成功",
      redirectTo: getHomePathForRole(user.role),
      user: {
        username: user.username,
        role: user.role,
      },
    });

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
    });

    return response;
  } catch (error) {
    console.error("[auth/login] 登录接口异常", {
      error,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { message: "登录服务异常，请稍后重试" },
      { status: 500 }
    );
  }
}
