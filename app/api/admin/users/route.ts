import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma, type UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

const ALLOWED_CREATE_ROLES: UserRole[] = ["STAFF", "CLIENT"];

const REAL_NAME_MAX = 50;

type CreateUserBody = {
  username?: string;
  password?: string;
  role?: UserRole;
  realName?: string | null;
};

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
  if (raw === null || raw === undefined) {
    return null;
  }
  const t = String(raw).trim();
  if (!t) {
    return null;
  }
  if (t.length > REAL_NAME_MAX) {
    return null;
  }
  return t;
}

/**
 * 校验创建账号入参是否完整、合法。
 */
function validateCreateBody(body: CreateUserBody): string | null {
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username) {
    return "请填写登录账号";
  }
  if (username.length < 2) {
    return "账号至少 2 个字符";
  }
  if (!password || password.length < 6) {
    return "密码至少 6 位";
  }
  if (!body.role || !ALLOWED_CREATE_ROLES.includes(body.role)) {
    return "请选择角色：仓库员工或客户";
  }
  if (body.role === "CLIENT" && body.realName !== undefined && body.realName !== null) {
    const t = String(body.realName).trim();
    if (t.length > REAL_NAME_MAX) {
      return `真实姓名最多 ${REAL_NAME_MAX} 个字符`;
    }
  }
  return null;
}

/**
 * 管理员查询员工与客户账号列表（不含管理员自身敏感信息）。
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) {
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
  if (gate instanceof NextResponse) {
    return gate;
  }

  let body: CreateUserBody;
  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ message: "请求格式无效，请刷新页面后重试" }, { status: 400 });
  }
  const err = validateCreateBody(body);
  if (err) {
    return NextResponse.json({ message: err }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const role = body.role as UserRole;

  try {
    const passwordHash = await hash(body.password ?? "", 10);
    const realName = normalizeOptionalRealName(role, body.realName);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
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
    console.error("[POST /api/admin/users] create failed:", e);

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { message: "该账号已存在，请换一个用户名" },
          { status: 409 }
        );
      }
      if (e.code === "P2025") {
        return NextResponse.json(
          { message: "记录依赖不满足，创建失败" },
          { status: 400 }
        );
      }
    }

    const metaMsg = e instanceof Error ? e.message : String(e);
    if (/no such column|Unknown column|does not exist on type/i.test(metaMsg)) {
      return NextResponse.json(
        {
          message:
            "数据库表结构不是最新（可能缺少 realName、isBanned 等字段）。请在项目目录执行 npx prisma migrate deploy（开发环境：npx prisma migrate dev），然后重启服务再试。",
        },
        { status: 500 }
      );
    }
    if (/SQLITE_BUSY|database is locked|locked/i.test(metaMsg)) {
      return NextResponse.json(
        {
          message:
            "数据库正忙（SQLite 被占用）。请关闭其他访问该库的窗口后重试，或重启开发服务后再创建。",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        message: "创建失败，请稍后重试",
        ...(process.env.NODE_ENV === "development" && e instanceof Error
          ? { detail: metaMsg }
          : {}),
      },
      { status: 500 }
    );
  }
}
