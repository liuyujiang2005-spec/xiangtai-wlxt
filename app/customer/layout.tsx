import type { ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/require-page-access";

type CustomerLayoutProps = {
  children: ReactNode;
};

/**
 * 客户模块根布局：仅执行角色校验，不包含侧边栏外壳。
 * 适用于需要权限校验但不需要 AppShell（如打印面单）的页面。
 */
export default async function CustomerLayout({
  children,
}: CustomerLayoutProps) {
  // 强制要求 CLIENT 角色
  await requirePageRole(["CLIENT"]);

  return <>{children}</>;
}
