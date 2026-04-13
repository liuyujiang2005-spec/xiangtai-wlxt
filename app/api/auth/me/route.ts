import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/get-session";
import { prisma } from "@/lib/prisma";

/**
 * 返回当前登录用户信息，供顶栏等客户端组件使用。
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        username: true,
        role: true,
        realName: true,
        isBanned: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    if (dbUser.isBanned) {
      return NextResponse.json(
        { message: "账号已封禁", banned: true },
        { status: 403 }
      );
    }

    return NextResponse.json({
      user: {
        username: dbUser.username,
        role: dbUser.role,
        realName:
          dbUser.role === "CLIENT" ? dbUser.realName ?? null : null,
      },
    });
  } catch (err) {
    console.error("[auth/me] 数据库查询失败，回退到会话内角色信息:", err);
    return NextResponse.json({
      user: {
        username: session.username,
        role: session.role,
        realName: null,
      },
    });
  }
}
