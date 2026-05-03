import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";
import { requirePageRole } from "@/lib/auth/require-page-access";

type StaffLayoutProps = {
  children: ReactNode;
};

/**
 * 员工区布局：带角色侧边导航。
 */
export default async function StaffLayout({ children }: StaffLayoutProps) {
  await requirePageRole(["STAFF"]);
  return <AppShell>{children}</AppShell>;
}
