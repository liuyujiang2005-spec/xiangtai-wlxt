import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type UpdateBody = {
  seaPrice?: number;
  landPrice?: number;
};

/**
 * 读取管理员维护的渠道单价。
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  const setting = await prisma.pricingSetting.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!setting) {
    const created = await prisma.pricingSetting.create({
      data: {
        seaPrice: 580,
        landPrice: 620,
      },
    });
    return NextResponse.json(created);
  }
  return NextResponse.json(setting);
}

/**
 * 更新海运/陆运基础单价（¥/CBM）。
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  const body = (await request.json()) as UpdateBody;
  const seaPrice = body.seaPrice;
  const landPrice = body.landPrice;
  if (
    typeof seaPrice !== "number" ||
    Number.isNaN(seaPrice) ||
    seaPrice < 0 ||
    typeof landPrice !== "number" ||
    Number.isNaN(landPrice) ||
    landPrice < 0
  ) {
    return NextResponse.json({ message: "单价参数无效" }, { status: 400 });
  }
  const existing = await prisma.pricingSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const updated = existing
    ? await prisma.pricingSetting.update({
        where: { id: existing.id },
        data: {
          seaPrice,
          landPrice,
          updatedById: gate.sub,
        },
      })
    : await prisma.pricingSetting.create({
        data: {
          seaPrice,
          landPrice,
          updatedById: gate.sub,
        },
      });
  return NextResponse.json({ message: "单价已更新", setting: updated });
}
