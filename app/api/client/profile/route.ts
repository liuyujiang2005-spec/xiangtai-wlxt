import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/auth/require-client";
import { handleApiError } from "@/lib/api-error";

const REAL_NAME_MAX = 50;

const ProfileSchema = z.object({
  realName: z
    .string()
    .trim()
    .max(REAL_NAME_MAX, `真实姓名最多 ${REAL_NAME_MAX} 个字符`)
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : val)),
});

/**
 * 客户读取个人资料（含可选真实姓名）。
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireClient();
  if (gate instanceof Response || (gate && typeof gate === 'object' && 'status' in gate)) {
    return gate as any;
  }

  const user = await prisma.user.findUnique({
    where: { id: gate.sub },
    select: { isBanned: true, realName: true, username: true },
  });

  if (!user || user.isBanned) {
    return NextResponse.json({ message: "账号不可用" }, { status: 403 });
  }

  return NextResponse.json({
    username: user.username,
    realName: user.realName,
  });
}

/**
 * 客户更新可选真实姓名（仅客户端使用）。
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const gate = await requireClient();
  if (gate instanceof Response || (gate && typeof gate === 'object' && 'status' in gate)) {
    return gate as any;
  }

  try {
    let bodyData: unknown;
    try {
      bodyData = await request.json();
    } catch {
      return NextResponse.json({ message: "请求格式错误" }, { status: 400 });
    }

    const { realName } = ProfileSchema.parse(bodyData);

    const existing = await prisma.user.findUnique({
      where: { id: gate.sub },
      select: { isBanned: true },
    });
    if (!existing || existing.isBanned) {
      return NextResponse.json({ message: "账号不可用" }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id: gate.sub },
      data: { realName },
      select: { realName: true },
    });

    return NextResponse.json({ message: "已保存", realName: updated.realName });
  } catch (e) {
    return handleApiError(e);
  }
}
