import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isNextResponse } from "@/lib/auth/is-next-response";
import { handleApiError } from "@/lib/api-error";

const BatchStatusSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "请至少选择一票运单"),
  containerTruckNo: z.string().trim().max(100).optional().nullable(),
});

/**
 * 管理员批量改态：将选中正式运单一键更新为“已装柜”。
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (isNextResponse(gate)) {
    return gate;
  }

  try {
    let bodyData: unknown;
    try {
      bodyData = await request.json();
    } catch {
      return NextResponse.json({ message: "请求格式错误" }, { status: 400 });
    }

    const { ids, containerTruckNo } = BatchStatusSchema.parse(bodyData);
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
  } catch (e) {
    return handleApiError(e);
  }
}
