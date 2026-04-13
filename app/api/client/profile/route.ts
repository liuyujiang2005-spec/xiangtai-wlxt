import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/auth/require-client";

type PatchBody = {
  realName?: string | null;
};

const REAL_NAME_MAX = 50;

/**
 * 将可选真实姓名规范化为数据库可存值（空串视为清除）。
 */
function normalizeRealName(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  if (!t) {
    return null;
  }
  return t.slice(0, REAL_NAME_MAX);
}

/**
 * 客户读取个人资料（含可选真实姓名）。
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireClient();
  if (gate instanceof NextResponse) {
    return gate;
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
  if (gate instanceof NextResponse) {
    return gate;
  }

  const body = (await request.json()) as PatchBody;
  const nextName = normalizeRealName(body.realName);

  const existing = await prisma.user.findUnique({
    where: { id: gate.sub },
    select: { isBanned: true },
  });
  if (!existing || existing.isBanned) {
    return NextResponse.json({ message: "账号不可用" }, { status: 403 });
  }

  if (
    typeof body.realName === "string" &&
    body.realName.trim().length > REAL_NAME_MAX
  ) {
    return NextResponse.json(
      { message: `真实姓名最多 ${REAL_NAME_MAX} 个字符` },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: gate.sub },
    data: { realName: nextName },
    select: { realName: true },
  });

  return NextResponse.json({ message: "已保存", realName: updated.realName });
}
