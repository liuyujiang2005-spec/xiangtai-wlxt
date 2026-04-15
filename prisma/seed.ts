import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, UserRole } from "../app/generated/prisma/client";
import { resolveSqliteFileUrl } from "../lib/resolve-sqlite-url";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: resolveSqliteFileUrl(databaseUrl) }),
});

/**
 * 初始化生产环境基础账号（admin 必建，其他按需保留）。
 */
async function seedUsers(): Promise<void> {
  const adminHash = await hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      isBanned: false,
    },
    create: {
      username: "admin",
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      isBanned: false,
    },
  });
}

/**
 * Seed 脚本入口。
 */
async function main(): Promise<void> {
  await seedUsers();
  console.log("Prisma seed 完成：admin 账号已就绪。");
}

main()
  .catch((error) => {
    console.error("Prisma seed 失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
