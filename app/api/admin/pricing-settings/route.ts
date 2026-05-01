import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";

const UpdateBodySchema = z.object({
  seaPrice: z.number().min(0, "海运单价不能小于 0"),
  landPrice: z.number().min(0, "陆运单价不能小于 0"),
});

/**
 * 读取管理员维护的渠道单价。
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  try {
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
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 更新海运/陆运基础单价（¥/CBM）。
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  try {
    const body = UpdateBodySchema.parse(await request.json());
    const { seaPrice, landPrice } = body;

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
  } catch (error) {
    return handleApiError(error);
  }
}
