import { NextResponse } from "next/server";
import type { PreOrderStatus, Warehouse } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/auth/require-client";

const VALID_WAREHOUSES: Warehouse[] = [
  "YIWU",
  "GUANGZHOU",
  "SHENZHEN",
  "DONGGUAN",
];
const VALID_STATUS: PreOrderStatus[] = [
  "PRE_ALERT",
  "ARRIVED_FULL",
  "SHIPPED",
];

/**
 * 解析正整数页码与每页条数。
 */
function parsePageParams(url: URL): {
  page: number;
  pageSize: number;
} {
  const rawPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const rawSize = Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10);
  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const pageSize = Number.isNaN(rawSize)
    ? 10
    : Math.min(100, Math.max(1, rawSize));
  return { page, pageSize };
}

/**
 * 客户侧：分页查询 YB 预录单列表（仅当前登录客户）。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireClient();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("query") ?? "").trim();
  const warehouseParam = url.searchParams.get("warehouse");
  const statusParam = (url.searchParams.get("status") ?? "").trim();
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const { page, pageSize } = parsePageParams(url);

  const warehouse =
    warehouseParam &&
    VALID_WAREHOUSES.includes(warehouseParam as Warehouse)
      ? (warehouseParam as Warehouse)
      : undefined;

  const preOrderStatus =
    statusParam && VALID_STATUS.includes(statusParam as PreOrderStatus)
      ? (statusParam as PreOrderStatus)
      : undefined;

  const andFilters: object[] = [
    { clientUserId: auth.sub },
    { trackingNumber: { startsWith: "YB" } },
  ];
  if (query) {
    andFilters.push({ trackingNumber: { contains: query } });
  }
  if (warehouse) {
    andFilters.push({ warehouse });
  }
  if (preOrderStatus) {
    andFilters.push({ preOrderStatus });
  }

  if (dateFrom || dateTo) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) {
        createdAt.gte = d;
      }
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }
    if (createdAt.gte || createdAt.lte) {
      andFilters.push({ createdAt });
    }
  }

  const where = { AND: andFilters };

  const [total, rows] = await Promise.all([
    prisma.transportBill.count({ where }),
    prisma.transportBill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        trackingNumber: true,
        remark: true,
        shippingMark: true,
        shippingMethod: true,
        createdAt: true,
        destinationCountry: true,
        warehouse: true,
        preOrderStatus: true,
        totalPackages: true,
        isForecastPending: true,
      },
    }),
  ]);

  return NextResponse.json({
    list: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
