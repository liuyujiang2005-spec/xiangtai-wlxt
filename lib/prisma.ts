import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";
import { resolveSqliteFileUrl } from "@/lib/resolve-sqlite-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * 创建 Prisma SQLite 适配器，统一读取环境变量中的数据库地址。
 */
function createSqliteAdapter(): PrismaBetterSqlite3 {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!process.env.DATABASE_URL) {
    console.error("[prisma] DATABASE_URL 未配置，回退到 file:./dev.db");
  }
  return new PrismaBetterSqlite3({ url: resolveSqliteFileUrl(databaseUrl) });
}

/**
 * Prisma 单例客户端；生产与开发均挂到 global，避免多实例同时写 SQLite 触发 SQLITE_BUSY。
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: createSqliteAdapter(),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
