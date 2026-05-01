import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";

type AdminLayoutProps = {
  children: ReactNode;
};

/**
 * 管理员区布局：带角色侧边导航。
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
