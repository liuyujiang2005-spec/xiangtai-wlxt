import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCharge } from "@/lib/core/billing";
import { requireClient } from "@/lib/auth/require-client";
import { getClientShipmentStatusLabel } from "@/lib/customer/shipment-display";

/**
 * 客户只读运单列表：仅返回当前登录客户关联的运单（含预报单），含状态文案与待支付金额。
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireClient();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const bills = await prisma.transportBill.findMany({
    where: { clientUserId: auth.sub },
    orderBy: { createdAt: "desc" },
  });

  const list = bills.map((bill) => {
    const effectiveWaived = bill.isWaived || bill.isMinChargeWaived;
    const charge = calculateCharge({
      shippingMethod: bill.shippingMethod,
      actualCBM: bill.actualCBM,
      unitPrice: bill.unitPrice,
      isMinChargeWaived: effectiveWaived,
    });
    return {
      id: bill.id,
      trackingNumber: bill.trackingNumber,
      warehouse: bill.warehouse,
      shippingMethod: bill.shippingMethod,
      destinationCountry: bill.destinationCountry,
      preOrderStatus: bill.preOrderStatus,
      totalPackages: bill.totalPackages,
      actualCBM: bill.actualCBM,
      actualWeight: bill.actualWeight,
      unitPrice: bill.unitPrice,
      isMinChargeWaived: effectiveWaived,
      isWaived: effectiveWaived,
      waivedAmount: effectiveWaived ? bill.waivedAmount : 0,
      isForecastPending: bill.isForecastPending,
      domesticTracking: bill.domesticTracking,
      goodsName: bill.goodsName,
      estimatedPieces: bill.estimatedPieces,
      shippingMark: bill.shippingMark ?? auth.username,
      createdAt: bill.createdAt,
      statusLabel: getClientShipmentStatusLabel({
        isForecastPending: bill.isForecastPending,
        preOrderStatus: bill.preOrderStatus,
        shipmentStatus: bill.shipmentStatus,
      }),
      pendingAmount: charge.finalCharge,
      charge,
      hasMinCompensation:
        !effectiveWaived && charge.minChargeDifferenceFee > 0,
    };
  });

  return NextResponse.json({ list });
}
