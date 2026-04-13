import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type Body = {
  ids?: string[];
  containerTruckNo?: string;
};

/**
 * 管理员批量改态：将选中正式运单一键更新为“已装柜”。
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  const body = (await request.json()) as Body;
  const ids = (body.ids ?? []).filter((id) => typeof id === "string" && id.trim());
  if (ids.length === 0) {
    return NextResponse.json({ message: "请至少选择一票运单" }, { status: 400 });
  }
  const containerTruckNo = (body.containerTruckNo ?? "").trim();
  const uniqueIds = Array.from(new Set(ids));

  const existing = await prisma.transportBill.findMany({
    where: {
      id: { in: uniqueIds },
      isForecastPending: false,
    },
    select: {
      id: true,
      shipmentStatus: true,
    },
  });
  if (existing.length === 0) {
    return NextResponse.json({ message: "未找到可更新运单" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.transportBill.updateMany({
      where: { id: { in: existing.map((b) => b.id) } },
      data: {
        shipmentStatus: "LOADED",
        containerTruckNo: containerTruckNo || undefined,
      },
    });
    await tx.billStatusHistory.createMany({
      data: existing.map((b) => ({
        transportBillId: b.id,
        fromStatus: b.shipmentStatus,
        toStatus: "LOADED",
        operatorId: gate.sub,
        note: containerTruckNo
          ? `批量装柜，车号：${containerTruckNo}`
          : "批量一键改为已装柜",
      })),
    });
  });

  return NextResponse.json({
    message: `已批量更新 ${existing.length} 票为已装柜`,
    updatedCount: existing.length,
  });
}
