import { NextResponse } from "next/server";
import { type LoadingManifestStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type PatchBody = {
  status?: LoadingManifestStatus;
};

/**
 * 装柜任务详情：含关联运单与产品行。
 */
export async function GET(
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
        orderBy: { createdAt: "desc" },
        include: {
          billProducts: {
            orderBy: { sortOrder: "asc" },
          },
          clientUser: {
            select: { username: true },
          },
        },
      },
    },
  });
  if (!manifest) {
    return NextResponse.json({ message: "装柜任务不存在" }, { status: 404 });
  }
  return NextResponse.json({ manifest });
}

const VALID_NEXT_STATUS: Record<LoadingManifestStatus, LoadingManifestStatus[]> = {
  LOADING: ["SEALED"],
  SEALED: ["IN_TRANSIT"],
  IN_TRANSIT: ["ARRIVED"],
  ARRIVED: [],
};

/**
 * 更新柜状态（仅允许按流程推进）。
 */
export async function PATCH(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  const { id } = await context.params;
  const body = (await request.json()) as PatchBody;
  const target = body.status;
  if (!target) {
    return NextResponse.json({ message: "缺少状态参数" }, { status: 400 });
  }
  const manifest = await prisma.loadingManifest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      sealedAt: true,
      manifestNo: true,
      bills: { select: { id: true, shipmentStatus: true } },
    },
  });
  if (!manifest) {
    return NextResponse.json({ message: "装柜任务不存在" }, { status: 404 });
  }
  if (!VALID_NEXT_STATUS[manifest.status].includes(target)) {
    return NextResponse.json(
      { message: `状态流转不合法：${manifest.status} -> ${target}` },
      { status: 400 }
    );
  }
  const next = await prisma.$transaction(async (tx) => {
    const updated = await tx.loadingManifest.update({
      where: { id },
      data: {
        status: target,
        sealedAt: target === "SEALED" ? manifest.sealedAt ?? new Date() : manifest.sealedAt,
      },
    });
    if (target === "IN_TRANSIT" || target === "ARRIVED") {
      const note =
        target === "IN_TRANSIT"
          ? `柜号 ${manifest.manifestNo} 已发运，运输中。`
          : `柜号 ${manifest.manifestNo} 已到达泰国。`;
      await tx.billStatusHistory.createMany({
        data: manifest.bills.map((b) => ({
          transportBillId: b.id,
          fromStatus: b.shipmentStatus,
          toStatus: target === "IN_TRANSIT" ? "CUSTOMS_CLEARING" : "ARRIVED_TH",
          operatorId: gate.sub,
          note,
        })),
      });
      await tx.transportBill.updateMany({
        where: { id: { in: manifest.bills.map((b) => b.id) } },
        data: {
          shipmentStatus: target === "IN_TRANSIT" ? "CUSTOMS_CLEARING" : "ARRIVED_TH",
        },
      });
    }
    return updated;
  });
  return NextResponse.json({ message: "柜状态已更新", manifest: next });
}
