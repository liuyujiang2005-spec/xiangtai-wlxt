import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { type UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isNextResponse } from "@/lib/auth/is-next-response";
import { handleApiError } from "@/lib/api-error";

const REAL_NAME_MAX = 50;

const CreateUserSchema = z.object({
  username: z.string().trim().min(2, "账号至少 2 个字符").max(64, "账号超出最大长度限制"),
  password: z.string().min(6, "密码至少 6 位").max(128, "密码超出最大长度限制"),
  role: z.enum(["STAFF", "CLIENT"], {
    message: "请选择角色：仓库员工或客户",
  }),
  realName: z
    .string()
    .trim()
    .max(REAL_NAME_MAX, `真实姓名最多 ${REAL_NAME_MAX} 个字符`)
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : val)),
});

/**
 * 将管理员创建客户时可选填的真实姓名规范化为可存值。
 */
function normalizeOptionalRealName(
  role: UserRole,
  raw: string | null | undefined
): string | null {
  if (role !== "CLIENT") {
    return null;
  }
  return raw ?? null;
}

/**
 * 管理员查询员工与客户账号列表（不含管理员自身敏感信息）。
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (isNextResponse(gate)) {
    return gate;
  }

  const users = await prisma.user.findMany({
    where: {
      role: { in: ["STAFF", "CLIENT"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      role: true,
      realName: true,
      isBanned: true,
      discountRate: true,
      specialSeaPrice: true,
      specialLandPrice: true,
      createdAt: true,
    },
  });

  const volumeGroup = await prisma.transportBill.groupBy({
    by: ["clientUserId"],
    where: {
      clientUserId: { not: null },
      isForecastPending: false,
    },
    _sum: { actualCBM: true },
    _count: { _all: true },
  });
  const volumeMap = new Map(
    volumeGroup.map((g) => [
      g.clientUserId ?? "",
      {
        totalVolume: g._sum.actualCBM ?? 0,
        totalOrders: g._count._all ?? 0,
      },
    ])
  );
  return NextResponse.json({
    list: users.map((u) => ({
      ...u,
      totalVolume: volumeMap.get(u.id)?.totalVolume ?? 0,
      totalOrders: volumeMap.get(u.id)?.totalOrders ?? 0,
    })),
  });
}

/**
 * 管理员创建员工端或客户端账号。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (isNextResponse(gate)) {
    return gate;
  }

  try {
    let bodyData: unknown;
    try {
      bodyData = await request.json();
    } catch {
      return NextResponse.json({ message: "请求格式无效，请刷新页面后重试" }, { status: 400 });
    }

    const { username, password, role, realName: rawRealName } = CreateUserSchema.parse(bodyData);

    const passwordHash = await hash(password, 10);
    const realName = normalizeOptionalRealName(role as UserRole, rawRealName);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: role as UserRole,
        realName,
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ message: "账号创建成功", user });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
