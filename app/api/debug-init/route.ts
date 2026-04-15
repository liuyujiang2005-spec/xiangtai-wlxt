import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 调试初始化：admin 账号强制 upsert（仅临时排障使用）。
 */
export async function GET(): Promise<NextResponse> {
  try {
    const passwordHash = await hash("password123", 10);
    await prisma.user.upsert({
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
    });

    return NextResponse.json({
      success: true,
      message: "Admin account initialized with hashed password",
    });
  } catch (error) {
    console.error("[debug-init] 初始化 admin 失败", {
      error,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Admin initialization failed",
      },
      { status: 500 }
    );
  }
}
