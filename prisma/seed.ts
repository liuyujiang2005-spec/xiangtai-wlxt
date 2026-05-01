import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import { resolveSqliteFileUrl } from "../lib/resolve-sqlite-url";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: resolveSqliteFileUrl(databaseUrl) }),
});

/**
 * Seed 脚本入口。
 */
async function main(): Promise<void> {
  console.log("Prisma seed 已跳过默认账号初始化。");
}

main()
  .catch((error) => {
    console.error("Prisma seed 失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
