import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 导出当前柜号报关汇总清单（CSV，可直接用 Excel 打开）。
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
        include: {
          billProducts: true,
        },
      },
    },
  });
  if (!manifest) {
    return NextResponse.json({ message: "装柜任务不存在" }, { status: 404 });
  }
  const map = new Map<
    string,
    { productName: string; boxCount: number; totalWeight: number; totalVolume: number }
  >();
  for (const bill of manifest.bills) {
    for (const p of bill.billProducts) {
      const key = p.productName.trim() || "未命名";
      const prev = map.get(key) ?? {
        productName: key,
        boxCount: 0,
        totalWeight: 0,
        totalVolume: 0,
      };
      prev.boxCount += p.boxCount;
      prev.totalWeight += p.totalWeightKg ?? 0;
      prev.totalVolume += p.totalVolumeCbm ?? 0;
      map.set(key, prev);
    }
  }
  const header = ["品名", "箱数", "重量(KG)", "体积(CBM)"];
  const rows = Array.from(map.values()).map((r) =>
    [r.productName, String(r.boxCount), r.totalWeight.toFixed(3), r.totalVolume.toFixed(6)]
      .map((cell) => `"${cell.replaceAll('"', '""')}"`)
      .join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");
  const filename = `${manifest.manifestNo}-报关清单.csv`;
  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
