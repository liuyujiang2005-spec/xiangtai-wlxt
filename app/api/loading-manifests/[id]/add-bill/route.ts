import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";
import { isNextResponse } from "@/lib/auth/is-next-response";
import { handleApiError } from "@/lib/api-error";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const AddBillSchema = z.object({
  trackingNumber: z.string().trim().startsWith("XT", "请输入 XT 正式运单号"),
});

/**
 * 关联 XT 运单到指定柜号，并同步改态为“已装柜”。
 */
export async function PATCH(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (isNextResponse(gate)) {
    return gate;
  }

  try {
    const { id } = await context.params;

    let bodyData: unknown;
    try {
      bodyData = await request.json();
    } catch {
      return NextResponse.json({ message: "请求格式错误" }, { status: 400 });
    }

    const { trackingNumber } = AddBillSchema.parse(bodyData);

    const manifest = await prisma.loadingManifest.findUnique({ where: { id } });
    if (!manifest) {
      return NextResponse.json({ message: "装柜任务不存在" }, { status: 404 });
    }
    if (manifest.status !== "LOADING") {
      return NextResponse.json({ message: "该柜已封柜/在途，不可继续加单" }, { status: 400 });
    }
    
    const bill = await prisma.transportBill.findFirst({
      where: {
        trackingNumber,
        isForecastPending: false,
      },
    });
    if (!bill) {
      return NextResponse.json({ message: "未找到可装柜的 XT 运单" }, { status: 404 });
    }
    if (bill.manifestId && bill.manifestId !== id) {
      return NextResponse.json({ message: "该运单已在其他柜中" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.transportBill.update({
        where: { id: bill.id },
        data: {
          manifestId: id,
          shipmentStatus: "LOADED",
          containerTruckNo: manifest.manifestNo,
        },
      });
      await tx.billStatusHistory.create({
        data: {
          transportBillId: bill.id,
          fromStatus: bill.shipmentStatus,
          toStatus: "LOADED",
          operatorId: gate.sub,
          note: `货物已装柜，柜号：${manifest.manifestNo}`,
        },
      });
      return next;
    });

    return NextResponse.json({
      message: "运单已加入装柜清单",
      bill: updated,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
