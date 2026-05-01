import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * 统一的 API 异常捕获和格式化处理
 * - 拦截 ZodError，返回清晰的字段级错误信息 (400)
 * - 拦截 Prisma 常见的已知错误，避免向前端暴露数据库表结构 (如 409 冲突, 404 记录不存在)
 * - 兜底未知错误，打印错误堆栈，向客户端仅返回通用提示 (500)
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    const zodError = error as z.ZodError<any>;
    const messages = zodError.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("；");
    return NextResponse.json({ message: `输入参数有误：${messages}` }, { status: 400 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // 唯一约束冲突（如重复用户名或重复记录）
    if (error.code === "P2002") {
      return NextResponse.json(
        { message: "相关记录已存在，请检查输入或更换唯一标识（如用户名）" },
        { status: 409 }
      );
    }
    // 找不到对应的依赖记录（如外键指向不存在的数据）
    if (error.code === "P2025") {
      return NextResponse.json(
        { message: "引用的前置记录不存在或已被删除，操作失败" },
        { status: 404 }
      );
    }
  }

  const metaMsg = error instanceof Error ? error.message : String(error);
  
  // 针对 SQLite 锁或未迁移结构的保守回退
  if (/no such column|Unknown column|does not exist on type/i.test(metaMsg)) {
    return NextResponse.json(
      {
        message: "数据库结构未更新。请执行 npx prisma migrate deploy 同步表结构后重试。",
      },
      { status: 500 }
    );
  }
  if (/SQLITE_BUSY|database is locked|locked/i.test(metaMsg)) {
    return NextResponse.json(
      {
        message: "数据库正忙（被锁定）。请关闭其他连接窗口或稍后重试。",
      },
      { status: 503 }
    );
  }

  console.error("[API_UNHANDLED_ERROR]", {
    message: metaMsg,
    stack: error instanceof Error ? error.stack : undefined,
    error,
  });

  return NextResponse.json(
    {
      message: "服务器内部异常，请稍后重试",
      ...(process.env.NODE_ENV === "development" && error instanceof Error
        ? { detail: error.message }
        : {}),
    },
    { status: 500 }
  );
}
