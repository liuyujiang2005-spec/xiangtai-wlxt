import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCharge } from "@/lib/core/billing";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();

  const bills = await prisma.transportBill.findMany({
    where: {
      ...(query ? {
        OR: [
          { trackingNumber: { contains: query } },
          { shippingMark: { contains: query } },
          { domesticTracking: { contains: query } },
          { containerTruckNo: { contains: query } },
          { clientUser: { username: { contains: query } } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { clientUser: { select: { username: true, realName: true } } },
  });

  const list = bills.map((bill) => {
    const charge = calculateCharge({
      shippingMethod: bill.shippingMethod,
      actualCBM: bill.actualCBM,
      unitPrice: bill.unitPrice,
      isMinChargeWaived: bill.isMinChargeWaived,
    });
    const { clientUser, ...rest } = bill;
    return {
      ...rest,
      clientLogin: clientUser?.username ?? null,
      shippingMark: bill.shippingMark ?? clientUser?.username ?? null,
      charge,
      hasMinCompensation: !bill.isMinChargeWaived && charge.minChargeDifferenceFee > 0,
    };
  });

  return NextResponse.json({ list });
}
