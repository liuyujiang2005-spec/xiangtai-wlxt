import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCharge } from "@/lib/core/billing";
import { requireAdmin } from "@/lib/auth/require-admin";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * 豁免指定运单的低消，并返回更新后的费用信息用于前端即时刷新。
 */
export async function PATCH(
  _request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }

  const { id } = await context.params;

  const existing = await prisma.transportBill.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ message: "运单不存在" }, { status: 404 });
  }

  const beforeCharge = calculateCharge({
    shippingMethod: existing.shippingMethod,
    actualCBM: existing.actualCBM,
    unitPrice: existing.unitPrice,
    isMinChargeWaived: false,
  });

  const bill = await prisma.transportBill.update({
    where: { id },
    data: {
      isWaived: true,
      waivedAmount: beforeCharge.minChargeDifferenceFee,
      isMinChargeWaived: true,
    },
  });

  const charge = calculateCharge({
    shippingMethod: bill.shippingMethod,
    actualCBM: bill.actualCBM,
    unitPrice: bill.unitPrice,
    isMinChargeWaived: bill.isMinChargeWaived,
  });

  return NextResponse.json({
    message: "已豁免低消",
    bill,
    charge,
    hasMinCompensation: false,
  });
}
