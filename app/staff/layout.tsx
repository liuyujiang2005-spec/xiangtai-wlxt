import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";

type StaffLayoutProps = {
  children: ReactNode;
};

/**
 * 员工区布局：带角色侧边导航。
 */
export default function StaffLayout({ children }: StaffLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
