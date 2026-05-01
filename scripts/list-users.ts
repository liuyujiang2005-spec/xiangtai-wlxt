import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * 列出所有用户及封禁状态，用于排查无法登录。
 */
async function main(): Promise<void> {
  const users = await prisma.user.findMany({
    orderBy: { username: "asc" },
    select: { username: true, role: true, isBanned: true },
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
