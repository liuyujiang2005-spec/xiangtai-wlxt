import { NextResponse } from "next/server";
import {
  type LoadingManifestStatus,
  type Warehouse,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";

const WAREHOUSES = ["YIWU", "GUANGZHOU", "SHENZHEN", "DONGGUAN"] as const;

const CreateBodySchema = z.object({
  warehouse: z.enum(WAREHOUSES, {
    message: "仓库参数无效",
  }),
  carrierInfo: z.string().optional().transform(v => (v ?? "").trim()),
});

/**
 * 生成装柜单号：CN-TH-YYYYMMDDNNN。
 */
function buildManifestNo(dateKey: string, serial: number): string {
  return `CN-TH-${dateKey}${String(serial).padStart(3, "0")}`;
}

/**
 * 读取当天最大序号并生成新柜号。
 */
async function issueManifestNo(tx: any, now: Date): Promise<string> {
  const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const prefix = `CN-TH-${dateKey}`;
  const list = await tx.loadingManifest.findMany({
    where: {
      manifestNo: {
        startsWith: prefix,
      },
    },
    select: { manifestNo: true },
  });
  let max = 0;
  for (const item of list) {
    const n = Number.parseInt(item.manifestNo.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) {
      max = n;
    }
  }
  return buildManifestNo(dateKey, max + 1);
}

/**
 * 装柜任务列表：支持柜号关键字与状态筛选，并返回票数/件数/体积统计。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  try {
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get("query") ?? "").trim();
    const status = (searchParams.get("status") ?? "").trim() as LoadingManifestStatus | "";
    const list = await prisma.loadingManifest.findMany({
      where: {
        ...(keyword
          ? {
              manifestNo: {
                contains: keyword,
              },
            }
          : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        bills: {
          select: {
            id: true,
            totalPackages: true,
            actualCBM: true,
          },
        },
      },
    });
    return NextResponse.json({
      list: list.map((m) => {
        const totalBills = m.bills.length;
        const totalPackages = m.bills.reduce((sum, b) => sum + (b.totalPackages ?? 0), 0);
        const totalVolume = m.bills.reduce((sum, b) => sum + (b.actualCBM ?? 0), 0);
        return {
          id: m.id,
          manifestNo: m.manifestNo,
          warehouse: m.warehouse,
          status: m.status,
          carrierInfo: m.carrierInfo,
          sealedAt: m.sealedAt,
          totalBills,
          totalPackages,
          totalVolume,
          createdAt: m.createdAt,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 新建装柜任务并自动生成柜号。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }
  try {
    const body = CreateBodySchema.parse(await request.json());
    const manifest = await prisma.$transaction(async (tx) => {
      const manifestNo = await issueManifestNo(tx, new Date());
      return tx.loadingManifest.create({
        data: {
          manifestNo,
          warehouse: body.warehouse as Warehouse,
          status: "LOADING",
          carrierInfo: body.carrierInfo || null,
          createdById: gate.sub,
        },
      });
    });
    return NextResponse.json({ message: "装柜任务已创建", manifest });
  } catch (error) {
    return handleApiError(error);
  }
}
