import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCharge } from "@/lib/core/billing";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * 管理员财务汇总：运单量、应收合计、方式与低消相关统计。
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const bills = await prisma.transportBill.findMany({
    where: {
      isForecastPending: false,
      trackingNumber: { startsWith: "XT" },
    },
    orderBy: { createdAt: "desc" },
    include: {
      clientUser: {
        select: {
          username: true,
          realName: true,
        },
      },
    },
  });

  let totalProjectedRevenue = 0;
  let totalWaivedAmount = 0;
  let totalActualReceivable = 0;
  let monthProjectedRevenue = 0;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  /**
   * 获取低消体积门槛：海运 0.5 / 陆运 0.3。
   */
  function getMinVolume(method: "SEA" | "LAND"): number {
    return method === "SEA" ? 0.5 : 0.3;
  }

  const rows = bills.map((bill) => {
    const effectiveWaived = bill.isWaived || bill.isMinChargeWaived;
    const charge = calculateCharge({
      shippingMethod: bill.shippingMethod,
      actualCBM: bill.actualCBM,
      unitPrice: bill.unitPrice,
      isMinChargeWaived: effectiveWaived,
    });
    const rawCharge = calculateCharge({
      shippingMethod: bill.shippingMethod,
      actualCBM: bill.actualCBM,
      unitPrice: bill.unitPrice,
      isMinChargeWaived: false,
    });
    const waivedAmount = effectiveWaived
      ? bill.waivedAmount > 0
        ? bill.waivedAmount
        : rawCharge.minChargeDifferenceFee
      : 0;
    const projectedFinal = rawCharge.finalCharge;
    totalProjectedRevenue += projectedFinal;
    totalWaivedAmount += waivedAmount;
    totalActualReceivable += charge.finalCharge;
    if (bill.createdAt >= monthStart) {
      monthProjectedRevenue += projectedFinal;
    }
    return {
      id: bill.id,
      trackingNumber: bill.trackingNumber,
      warehouse: bill.warehouse,
      clientName: bill.clientUser?.username ?? "未绑定",
      shippingMark: bill.shippingMark ?? bill.clientUser?.username ?? "—",
      actualCBM: bill.actualCBM,
      billingCBM: effectiveWaived
        ? bill.actualCBM
        : Math.max(bill.actualCBM, getMinVolume(bill.shippingMethod)),
      actualFee: charge.actualFee,
      minCompensationFee: effectiveWaived ? 0 : rawCharge.minChargeDifferenceFee,
      finalCharge: charge.finalCharge,
      isWaived: effectiveWaived,
      waivedAmount,
      createdAt: bill.createdAt,
    };
  });

  return NextResponse.json({
    totalBills: bills.length,
    monthProjectedRevenue,
    totalWaivedAmount,
    totalActualReceivable,
    rows,
  });
}
