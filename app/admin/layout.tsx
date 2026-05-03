import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";
import { requirePageRole } from "@/lib/auth/require-page-access";

type AdminLayoutProps = {
  children: ReactNode;
};

/**
 * 管理员区布局：带角色侧边导航。
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requirePageRole(["ADMIN"]);
  return <AppShell>{children}</AppShell>;
}
