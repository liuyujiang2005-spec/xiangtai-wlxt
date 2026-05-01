import "dotenv/config";

/**
 * 生产启动前校验关键环境变量，避免退回开发默认值。
 */
function main(): void {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    missing.push("DATABASE_URL");
  }
  if (!process.env.AUTH_SECRET?.trim() && !process.env.NEXTAUTH_SECRET?.trim()) {
    missing.push("AUTH_SECRET 或 NEXTAUTH_SECRET");
  }

  if (missing.length > 0) {
    console.error(
      `生产环境缺少必要变量：${missing.join("、")}。请先配置后再启动。`
    );
    process.exitCode = 1;
    return;
  }

  console.log("环境变量校验通过。");
}

main();
