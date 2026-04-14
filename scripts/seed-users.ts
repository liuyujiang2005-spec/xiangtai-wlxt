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

const seedUsers: SeedUser[] = [
  { username: "admin", password: "admin123", role: UserRole.ADMIN },
  { username: "Allen", password: "Allen123", role: UserRole.STAFF },
  { username: "测试", password: "测试123", role: UserRole.CLIENT },
];

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
  for (const user of seedUsers) {
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
  await seedDefaultUsers();
  console.log("默认账号已初始化：admin / Allen / 测试");
}

main()
  .catch((error) => {
    console.error("初始化账号失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
