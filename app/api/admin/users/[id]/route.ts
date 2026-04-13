import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type PatchBody = {
  password?: string;
  isBanned?: boolean;
  discountRate?: number | null;
  specialSeaPrice?: number | null;
  specialLandPrice?: number | null;
};

/**
 * 规范化 PATCH 请求体中的密码与封禁字段。
 */
function normalizePatchBody(body: PatchBody): {
  password?: string;
  isBanned?: boolean;
  discountRate?: number | null;
  specialSeaPrice?: number | null;
  specialLandPrice?: number | null;
} {
  const password =
    typeof body.password === "string" ? body.password.trim() : undefined;
  const isBanned =
    typeof body.isBanned === "boolean" ? body.isBanned : undefined;
  const discountRate =
    body.discountRate === null
      ? null
      : typeof body.discountRate === "number"
        ? body.discountRate
        : undefined;
  const specialSeaPrice =
    body.specialSeaPrice === null
      ? null
      : typeof body.specialSeaPrice === "number"
        ? body.specialSeaPrice
        : undefined;
  const specialLandPrice =
    body.specialLandPrice === null
      ? null
      : typeof body.specialLandPrice === "number"
        ? body.specialLandPrice
        : undefined;
  return { password, isBanned, discountRate, specialSeaPrice, specialLandPrice };
}

/**
 * 管理员更新指定员工或客户账号的密码与封禁状态（不可操作管理员账号）。
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }

  const { id } = await context.params;
  const body = normalizePatchBody((await request.json()) as PatchBody);

  if (
    body.password === undefined &&
    body.isBanned === undefined &&
    body.discountRate === undefined &&
    body.specialSeaPrice === undefined &&
    body.specialLandPrice === undefined
  ) {
    return NextResponse.json(
      { message: "请提供新密码或封禁状态" },
      { status: 400 }
    );
  }

  if (body.password !== undefined) {
    if (body.password.length < 6) {
      return NextResponse.json({ message: "新密码至少 6 位" }, { status: 400 });
    }
  }
  if (
    body.discountRate !== undefined &&
    body.discountRate !== null &&
    (Number.isNaN(body.discountRate) || body.discountRate <= 0 || body.discountRate > 1)
  ) {
    return NextResponse.json({ message: "折扣率应在 0~1 之间" }, { status: 400 });
  }
  if (
    body.specialSeaPrice !== undefined &&
    body.specialSeaPrice !== null &&
    (Number.isNaN(body.specialSeaPrice) || body.specialSeaPrice < 0)
  ) {
    return NextResponse.json({ message: "海运专属单价无效" }, { status: 400 });
  }
  if (
    body.specialLandPrice !== undefined &&
    body.specialLandPrice !== null &&
    (Number.isNaN(body.specialLandPrice) || body.specialLandPrice < 0)
  ) {
    return NextResponse.json({ message: "陆运专属单价无效" }, { status: 400 });
  }

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
}
