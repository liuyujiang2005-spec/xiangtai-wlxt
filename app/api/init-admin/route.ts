import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 校验初始化密钥，避免公开接口被未授权访问。
 */
function verifyInitKey(request: Request): string | null {
  const expected = (process.env.INIT_ADMIN_KEY ?? "").trim();
  if (!expected) {
    return "服务端未配置 INIT_ADMIN_KEY，已禁用初始化接口。";
  }
  const { searchParams } = new URL(request.url);
  const provided = (searchParams.get("key") ?? "").trim();
  if (!provided || provided !== expected) {
    return "初始化密钥无效。";
  }
  return null;
}

/**
 * 通过 URL 触发管理员账号初始化（仅限临时排障使用）。
 * 示例：/api/init-admin?key=你的密钥
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const keyError = verifyInitKey(request);
    if (keyError) {
      return NextResponse.json({ message: keyError }, { status: 403 });
    }
    const passwordHash = await hash("admin123", 10);
    const user = await prisma.user.upsert({
      where: { username: "admin" },
      update: {
        passwordHash,
        role: UserRole.ADMIN,
        isBanned: false,
      },
      create: {
        username: "admin",
        passwordHash,
        role: UserRole.ADMIN,
        isBanned: false,
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
    return NextResponse.json({
      message: "管理员账号已初始化",
      user,
      defaultPassword: "admin123",
    });
  } catch (error) {
    console.error("[init-admin] 初始化失败", {
      error,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { message: "初始化失败，请查看服务端日志" },
      { status: 500 }
    );
  }
}
