import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthSecret } from "@/lib/auth/config";
import { ensureAuthStorageReady } from "@/lib/auth/ensure-auth-storage";
import { getHomePathForRole } from "@/lib/auth/roles";
import { handleApiError } from "@/lib/api-error";
import {
  getSessionCookieName,
  signSessionToken,
} from "@/lib/auth/session-token";

const LoginSchema = z.object({
  username: z.string().trim().min(1, "账号不能为空").max(64, "账号超出最大长度限制"),
  password: z.string().min(1, "密码不能为空").max(128, "密码超出最大长度限制"),
});

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/**
 * 用户登录：校验账号密码并设置 HttpOnly 会话 Cookie。
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    let bodyData: unknown;
    try {
      bodyData = await request.json();
    } catch {
      return NextResponse.json(
        { message: "请求格式错误，请检查账号和密码输入" },
        { status: 400 }
      );
    }
    
    // Zod 会拦截校验不通过的情况抛出 ZodError，随后在统一处理拦截
    const { username, password } = LoginSchema.parse(bodyData);

    await ensureAuthStorageReady(prisma);

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
    return handleApiError(error);
  }
}
