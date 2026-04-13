import { existsSync } from "node:fs";
import path from "node:path";

/**
 * 从当前工作目录向上查找包含 prisma/schema.prisma 的目录，作为本项目根目录。
 * 避免在子目录执行命令时把 dev.db 指到错误路径。
 */
export function findPrismaProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 20; i += 1) {
    if (existsSync(path.join(dir, "prisma", "schema.prisma"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  /**
   * 若 IDE 打开的是仓库上一级目录，process.cwd() 可能落在「刘雨江湘泰物流网站」，
   * 而 prisma 实际在子目录 xiangtai-logistics 下；向上找不到 schema 时需再探测子目录。
   */
  const nestedSchema = path.join(
    process.cwd(),
    "xiangtai-logistics",
    "prisma",
    "schema.prisma"
  );
  if (existsSync(nestedSchema)) {
    return path.join(process.cwd(), "xiangtai-logistics");
  }
  return process.cwd();
}

/**
 * 将 DATABASE_URL 中的 SQLite 路径解析为基于项目根目录的绝对路径，
 * 避免 Next 与 CLI 工作目录不一致时连错库。
 */
export function resolveSqliteFileUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }
  let rest = databaseUrl.slice("file:".length).trim();
  if (rest.startsWith("//")) {
    const tail = rest.replace(/^\/+/, "");
    if (/^[a-zA-Z]:/.test(tail)) {
      return databaseUrl;
    }
    rest = tail;
  }
  const candidate = rest.replace(/^\.\//, "");
  if (path.isAbsolute(candidate)) {
    return `file:${candidate}`;
  }
  const root = findPrismaProjectRoot();
  const absolute = path.join(root, candidate);
  return `file:${absolute}`;
}
