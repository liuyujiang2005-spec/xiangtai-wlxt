import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, UserRole } from "../app/generated/prisma/client";
import { resolveSqliteFileUrl } from "../lib/resolve-sqlite-url";
import { ensureLocalOpsAllowed } from "./ops-guard";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: resolveSqliteFileUrl(databaseUrl) }),
});

type SeedUser = {
  username: string;
  password: string;
  role: UserRole;
};

function readSeedUsers(): SeedUser[] {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const staffPassword = process.env.SEED_STAFF_PASSWORD?.trim();
  const clientPassword = process.env.SEED_CLIENT_PASSWORD?.trim();

  if (!adminPassword || !staffPassword || !clientPassword) {
    throw new Error(
      "请先设置 SEED_ADMIN_PASSWORD、SEED_STAFF_PASSWORD、SEED_CLIENT_PASSWORD。"
    );
  }

  return [
    { username: "admin", password: adminPassword, role: UserRole.ADMIN },
    { username: "Allen", password: staffPassword, role: UserRole.STAFF },
    { username: "测试", password: clientPassword, role: UserRole.CLIENT },
  ];
}

/**
 * 对明文密码进行哈希，避免密码以明文方式存储在数据库中。
 */
async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

/**
 * 初始化系统默认账号，不存在则创建，存在则更新密码与角色。
 */
async function seedDefaultUsers(): Promise<void> {
  for (const user of readSeedUsers()) {
    const passwordHash = await hashPassword(user.password);
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        passwordHash,
        role: user.role,
        isBanned: false,
      },
      create: {
        username: user.username,
        passwordHash,
        role: user.role,
      },
    });
  }
}

/**
 * 脚本主入口，执行默认账号写入并输出结果。
 */
async function main(): Promise<void> {
  ensureLocalOpsAllowed("seed:users");
  await seedDefaultUsers();
  console.log("本地测试账号已初始化：admin / Allen / 测试");
}

main()
  .catch((error) => {
    console.error("初始化账号失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
