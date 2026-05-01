/**
 * 删除不符合当前单号规则的运单记录，并清空流水计数表（开发/整理数据用）。
 * 标准格式：预报 YB + 仓库码 + YYYYMMDD + 4 位；正式 仓库码 + YYYYMMDD + 4 位。
 * 运行：npx tsx scripts/cleanup-tracking-numbers.ts
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * 判断单号是否符合当前「整齐」规则。
 */
function isStandardTrackingNumber(trackingNumber: string): boolean {
  const pre = /^YB(XTYW|XTGZ|XTSZ|XTDG)\d{8}\d{4}$/;
  const formal = /^(XTYW|XTGZ|XTSZ|XTDG)\d{8}\d{4}$/;
  return pre.test(trackingNumber) || formal.test(trackingNumber);
}

/**
 * 执行清理：先删子表明细，再删运单，最后重置流水计数。
 */
async function main(): Promise<void> {
  const rows = await prisma.transportBill.findMany({
    select: { id: true, trackingNumber: true },
  });
  const badIds = rows
    .filter((r) => !isStandardTrackingNumber(r.trackingNumber))
    .map((r) => r.id);

  if (badIds.length === 0) {
    console.log("未发现非标准单号。流水已改为从运单表按日 MAX+1，计数表仅作遗留清理。");
  } else {
    await prisma.billProduct.deleteMany({
      where: { transportBillId: { in: badIds } },
    });
    const deleted = await prisma.transportBill.deleteMany({
      where: { id: { in: badIds } },
    });
    console.log(`已删除 ${String(deleted.count)} 条非标准运单及其产品明细。`);
  }

  const cleared = await prisma.trackingSerialCounter.deleteMany({});
  console.log(`已清空 TrackingSerialCounter（${String(cleared.count)} 行）。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
