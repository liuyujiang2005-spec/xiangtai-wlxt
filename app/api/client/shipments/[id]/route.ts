import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCharge } from "@/lib/core/billing";
import { requireClient } from "@/lib/auth/require-client";
import { buildShipmentTimeline } from "@/lib/customer/build-shipment-timeline";
import { getClientShipmentStatusLabel } from "@/lib/customer/shipment-display";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 客户查看本人运单详情：含产品明细、费用与物流时间轴节点。
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
      statusHistories: {
        orderBy: { createdAt: "asc" },
        select: {
          toStatus: true,
          createdAt: true,
        },
      },
    },
  });

  if (!bill) {
    return NextResponse.json({ message: "运单不存在或无权查看" }, { status: 404 });
  }

  const effectiveWaived = bill.isWaived || bill.isMinChargeWaived;
  const charge = calculateCharge({
    shippingMethod: bill.shippingMethod,
    actualCBM: bill.actualCBM,
    unitPrice: bill.unitPrice,
    isMinChargeWaived: effectiveWaived,
  });

  const timeline = buildShipmentTimeline(bill);

  return NextResponse.json({
    bill,
    markDisplay: bill.shippingMark ?? auth.username,
    statusLabel: getClientShipmentStatusLabel({
      isForecastPending: bill.isForecastPending,
      preOrderStatus: bill.preOrderStatus,
      shipmentStatus: bill.shipmentStatus,
    }),
    charge,
    pendingAmount: charge.finalCharge,
    isWaived: effectiveWaived,
    waivedAmount: effectiveWaived ? bill.waivedAmount : 0,
    timeline,
  });
}
