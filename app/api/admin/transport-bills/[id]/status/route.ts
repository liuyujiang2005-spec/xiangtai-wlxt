import { NextResponse } from "next/server";
import { type ShipmentStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isNextResponse } from "@/lib/auth/is-next-response";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const VALID_STATUS = [
  "ORDERED",
  "INBOUND_CONFIRMED",
  "LOADED",
  "CUSTOMS_CLEARING",
  "ARRIVED_TH",
  "OUT_FOR_DELIVERY",
  "SIGNED",
] as const;

const StatusUpdateSchema = z.object({
  shipmentStatus: z.enum(VALID_STATUS, {
    message: "状态参数无效",
  }),
  containerTruckNo: z.string().optional().transform(v => (v ?? "").trim()),
});

/**
 * 管理员强制修改正式运单状态。
 */
export async function PATCH(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (isNextResponse(gate)) {
    return gate;
  }
  const { id } = await context.params;

  try {
    const body = StatusUpdateSchema.parse(await request.json());
    const { shipmentStatus, containerTruckNo } = body;

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
  } catch (error) {
    return handleApiError(error);
  }
}
