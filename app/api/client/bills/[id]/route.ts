import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/auth/require-client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 客户查看本人运单/预录单详情（用于面单打印页）。
 */
export async function GET(
  _request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const auth = await requireClient();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const bill = await prisma.transportBill.findFirst({
    where: {
      id,
      clientUserId: auth.sub,
    },
    include: {
      billProducts: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!bill) {
    return NextResponse.json({ message: "运单不存在或无权查看" }, { status: 404 });
  }

  return NextResponse.json({
    bill,
    /** 与唛头一致，便于前端展示 */
    markDisplay: bill.shippingMark ?? auth.username,
  });
}
