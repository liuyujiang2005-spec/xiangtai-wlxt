import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isNextResponse } from "@/lib/auth/is-next-response";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";

const PatchBodySchema = z.object({
  password: z.string().trim().min(6, "新密码至少 6 位").optional(),
  isBanned: z.boolean().optional(),
  discountRate: z.number().min(0.01, "折扣率应在 0~1 之间").max(1, "折扣率应在 0~1 之间").nullable().optional(),
  specialSeaPrice: z.number().min(0, "海运专属单价无效").nullable().optional(),
  specialLandPrice: z.number().min(0, "陆运专属单价无效").nullable().optional(),
}).refine(
  (data) =>
    data.password !== undefined ||
    data.isBanned !== undefined ||
    data.discountRate !== undefined ||
    data.specialSeaPrice !== undefined ||
    data.specialLandPrice !== undefined,
  { message: "请提供需要更新的字段" }
);

/**
 * 管理员更新指定员工或客户账号的密码与封禁状态（不可操作管理员账号）。
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (isNextResponse(gate)) {
    return gate;
  }

  try {
    const { id } = await context.params;
    const body = PatchBodySchema.parse(await request.json());

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.role === "ADMIN") {
      return NextResponse.json({ message: "账号不存在或不可操作" }, { status: 404 });
    }

    const data: {
      passwordHash?: string;
      isBanned?: boolean;
      discountRate?: number | null;
      specialSeaPrice?: number | null;
      specialLandPrice?: number | null;
    } = {};
    if (body.password !== undefined) {
      data.passwordHash = await hash(body.password, 10);
    }
    if (body.isBanned !== undefined) {
      data.isBanned = body.isBanned;
    }
    if (target.role === "CLIENT") {
      if (body.discountRate !== undefined) {
        data.discountRate = body.discountRate;
      }
      if (body.specialSeaPrice !== undefined) {
        data.specialSeaPrice = body.specialSeaPrice;
      }
      if (body.specialLandPrice !== undefined) {
        data.specialLandPrice = body.specialLandPrice;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        role: true,
        isBanned: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ message: "已更新", user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
