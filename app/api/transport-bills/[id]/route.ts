import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 员工/管理员读取单票详情（含产品明细），用于“预报转正式单”预填。
 */
export async function GET(
  _request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  const { id } = await context.params;
  const bill = await prisma.transportBill.findUnique({
    where: { id },
    include: {
      billProducts: {
        orderBy: { sortOrder: "asc" },
      },
      clientUser: {
        select: { username: true },
      },
    },
  });
  if (!bill) {
    return NextResponse.json({ message: "运单不存在" }, { status: 404 });
  }
  return NextResponse.json({
    bill,
    clientLogin: bill.clientUser?.username ?? null,
  });
}
