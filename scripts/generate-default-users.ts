import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, UserRole } from "../app/generated/prisma/client";
import { resolveSqliteFileUrl } from "../lib/resolve-sqlite-url";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: resolveSqliteFileUrl(databaseUrl) }),
});

type SeedUser = {
  username: string;
  password: string;
  role: UserRole;
};

function readSeedUsers(): SeedUser[] | null {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const staffPassword = process.env.SEED_STAFF_PASSWORD?.trim();
  const clientPassword = process.env.SEED_CLIENT_PASSWORD?.trim();

  if (!adminPassword || !staffPassword || !clientPassword) {
    console.warn(
      "缺少 SEED_ADMIN_PASSWORD / SEED_STAFF_PASSWORD / SEED_CLIENT_PASSWORD 环境变量，跳过默认账号初始化。"
    );
    return null;
  }

  return [
    { username: "admin", password: adminPassword, role: UserRole.ADMIN },
    { username: "Allen", password: staffPassword, role: UserRole.STAFF },
    { username: "测试", password: clientPassword, role: UserRole.CLIENT },
  ];
}

async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

async function seedDefaultUsers(): Promise<void> {
  const users = readSeedUsers();
  if (!users) return;

  for (const user of users) {
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

async function main(): Promise<void> {
  await seedDefaultUsers();
  console.log("默认账号初始化完成。");
}

main()
  .catch((error) => {
    console.error("默认账号初始化失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
