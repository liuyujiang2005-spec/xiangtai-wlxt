import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../lib/prisma";

const MIN_LEN = 6;

/**
 * 将指定登录名的密码重置为新密码，并解除封禁（用于忘记密码或无法登录时）。
 */
async function main(): Promise<void> {
  const username = (process.argv[2] ?? "").trim();
  const plain = process.argv[3] ?? "";
  if (!username || !plain) {
    console.error(
      "用法: npx tsx scripts/reset-password.ts <登录名> <新密码>\n示例: npx tsx scripts/reset-password.ts Allen Allen123"
    );
    process.exitCode = 1;
    return;
  }
  if (plain.length < MIN_LEN) {
    console.error(`新密码至少 ${MIN_LEN} 位`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hash(plain, 10);
  const result = await prisma.user.updateMany({
    where: { username },
    data: { passwordHash, isBanned: false },
  });
  if (result.count === 0) {
    console.error(`未找到用户「${username}」。可先执行 npm run db:list-users 查看已有账号。`);
    process.exitCode = 1;
    return;
  }
  console.log(`已重置「${username}」的密码并解除封禁，请用新密码登录。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
