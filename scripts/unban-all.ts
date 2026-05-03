import "dotenv/config";
import { prisma } from "../lib/prisma";
import { ensureLocalOpsAllowed } from "./ops-guard";

/**
 * 将全部用户账号解除封禁（含管理员、员工、客户）。
 */
async function main(): Promise<void> {
  ensureLocalOpsAllowed("db:unban-all");
  const result = await prisma.user.updateMany({
    data: { isBanned: false },
  });
  console.log(`已解除封禁：${result.count} 个账号`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
