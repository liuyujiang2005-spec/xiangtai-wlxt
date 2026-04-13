import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";

/**
 * 员工/管理员获取客户列表（用于直接入库绑定客户）。
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }

  const list = await prisma.user.findMany({
    where: { role: "CLIENT", isBanned: false },
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      realName: true,
    },
  });

  return NextResponse.json({ list });
}
