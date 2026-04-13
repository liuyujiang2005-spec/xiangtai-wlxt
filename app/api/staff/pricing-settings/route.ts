import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";

/**
 * 员工读取生效单价（优先客户专属价，其次全局渠道价）。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  const { searchParams } = new URL(request.url);
  const clientUserId = (searchParams.get("clientUserId") ?? "").trim();
  if (!clientUserId) {
    return NextResponse.json({ message: "缺少 clientUserId" }, { status: 400 });
  }
  const [setting, user] = await Promise.all([
    prisma.pricingSetting.findFirst({
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findFirst({
      where: { id: clientUserId, role: "CLIENT" },
      select: {
        id: true,
        username: true,
        specialSeaPrice: true,
        specialLandPrice: true,
        discountRate: true,
      },
    }),
  ]);
  if (!user) {
    return NextResponse.json({ message: "客户不存在" }, { status: 404 });
  }
  const seaBase = setting?.seaPrice ?? 580;
  const landBase = setting?.landPrice ?? 620;
  const discount = user.discountRate ?? 1;
  const seaPrice =
    user.specialSeaPrice ??
    Number.parseFloat((seaBase * discount).toFixed(2));
  const landPrice =
    user.specialLandPrice ??
    Number.parseFloat((landBase * discount).toFixed(2));
  return NextResponse.json({
    clientUserId: user.id,
    shippingMark: user.username,
    seaPrice,
    landPrice,
    discountRate: user.discountRate ?? null,
  });
}
