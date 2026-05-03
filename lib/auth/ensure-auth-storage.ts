import type { PrismaClient } from "@/app/generated/prisma/client";

type SqliteColumnInfo = {
  name: string;
};

const USER_COLUMN_DEFINITIONS: Record<string, string> = {
  realName: 'ALTER TABLE "User" ADD COLUMN "realName" TEXT',
  isBanned: 'ALTER TABLE "User" ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT 0',
  discountRate: 'ALTER TABLE "User" ADD COLUMN "discountRate" REAL',
  specialSeaPrice: 'ALTER TABLE "User" ADD COLUMN "specialSeaPrice" REAL',
  specialLandPrice: 'ALTER TABLE "User" ADD COLUMN "specialLandPrice" REAL',
};

/**
 * 创建登录所需的用户表与唯一索引，避免生产环境迁移未执行时直接报错。
 */
async function ensureUserTableExists(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "realName" TEXT,
      "isBanned" BOOLEAN NOT NULL DEFAULT 0,
      "discountRate" REAL,
      "specialSeaPrice" REAL,
      "specialLandPrice" REAL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")'
  );
}

/**
 * 为旧版用户表补齐登录所需字段，兼容未完整迁移的 SQLite 数据库。
 */
async function ensureUserColumns(prisma: PrismaClient): Promise<void> {
  const columns = (await prisma.$queryRawUnsafe(
    'PRAGMA table_info("User")'
  )) as SqliteColumnInfo[];
  const existingColumnNames = new Set(columns.map((column) => column.name));
  for (const [columnName, sql] of Object.entries(USER_COLUMN_DEFINITIONS)) {
    if (existingColumnNames.has(columnName)) {
      continue;
    }
    await prisma.$executeRawUnsafe(sql);
  }
}

/**
 * 运行时兜底初始化登录依赖，只补齐登录所需表结构。
 * 不再自动创建或重置管理员账号，避免公开登录接口触发提权行为。
 */
export async function ensureAuthStorageReady(
  prisma: PrismaClient
): Promise<void> {
  await ensureUserTableExists(prisma);
  await ensureUserColumns(prisma);
}
