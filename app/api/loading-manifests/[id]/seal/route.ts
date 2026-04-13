import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 一键封柜：记录封柜时间并写入关联运单轨迹。
 */
export async function PATCH(
  _request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  const { id } = await context.params;
  const manifest = await prisma.loadingManifest.findUnique({
    where: { id },
    include: {
      bills: {
        select: { id: true, shipmentStatus: true },
      },
    },
  });
  if (!manifest) {
    return NextResponse.json({ message: "装柜任务不存在" }, { status: 404 });
  }
  if (manifest.status !== "LOADING") {
    return NextResponse.json({ message: "该柜已封柜或已进入运输流程" }, { status: 400 });
  }
  const sealedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.loadingManifest.update({
      where: { id },
      data: {
        status: "SEALED",
        sealedAt,
      },
    });
    if (manifest.bills.length > 0) {
      await tx.billStatusHistory.createMany({
        data: manifest.bills.map((b) => ({
          transportBillId: b.id,
          fromStatus: b.shipmentStatus,
          toStatus: "LOADED",
          operatorId: gate.sub,
          note: `${sealedAt.toLocaleString("zh-CN", { hour12: false })} 货物已装柜，柜号：${manifest.manifestNo}，准备发往泰国。`,
        })),
      });
    }
  });
  return NextResponse.json({ message: "已封柜", sealedAt });
}
