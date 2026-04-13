import { NextResponse } from "next/server";
import { type ShipmentStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type Body = {
  shipmentStatus?: ShipmentStatus;
  containerTruckNo?: string;
};

const VALID_STATUS: ShipmentStatus[] = [
  "ORDERED",
  "INBOUND_CONFIRMED",
  "LOADED",
  "CUSTOMS_CLEARING",
  "ARRIVED_TH",
  "OUT_FOR_DELIVERY",
  "SIGNED",
];

/**
 * 管理员强制修改正式运单状态。
 */
export async function PATCH(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  const { id } = await context.params;
  const body = (await request.json()) as Body;
  const shipmentStatus = body.shipmentStatus;
  const containerTruckNo = (body.containerTruckNo ?? "").trim();
  if (!shipmentStatus || !VALID_STATUS.includes(shipmentStatus)) {
    return NextResponse.json({ message: "状态参数无效" }, { status: 400 });
  }
  const existing = await prisma.transportBill.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "运单不存在" }, { status: 404 });
  }
  if (existing.isForecastPending) {
    return NextResponse.json({ message: "预报单未入库，无法改为轨迹状态" }, { status: 400 });
  }
  if (existing.shipmentStatus === shipmentStatus && !containerTruckNo) {
    return NextResponse.json({ message: "状态未变化", bill: existing });
  }
  const bill = await prisma.$transaction(async (tx) => {
    const updated = await tx.transportBill.update({
      where: { id },
      data: {
        shipmentStatus,
        containerTruckNo: containerTruckNo || undefined,
      },
    });
    await tx.billStatusHistory.create({
      data: {
        transportBillId: id,
        fromStatus: existing.shipmentStatus,
        toStatus: shipmentStatus,
        operatorId: gate.sub,
        note: containerTruckNo
          ? `车号：${containerTruckNo}`
          : "管理员单笔改态",
      },
    });
    return updated;
  });
  return NextResponse.json({ message: "状态已更新", bill });
}
