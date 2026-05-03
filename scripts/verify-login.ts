import "dotenv/config";
import { compare } from "bcryptjs";
import { prisma } from "../lib/prisma";

/**
 * 验证指定用户名与明文密码是否与数据库中哈希一致（仅本地排查用）。
 */
async function main(): Promise<void> {
  const username = (process.argv[2] ?? "").trim();
  const plain = process.argv[3] ?? "";
  if (!username || !plain) {
    console.error(
      "用法: npx tsx scripts/verify-login.ts <登录名> <明文密码>"
    );
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.log("用户不存在:", username);
    return;
  }
  const ok = await compare(plain, user.passwordHash);
  console.log("用户:", user.username, "角色:", user.role, "封禁:", user.isBanned);
  console.log("密码「" + plain + "」校验:", ok ? "通过" : "不通过");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
