import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";

type CustomerDashboardLayoutProps = {
  children: ReactNode;
};

/**
 * 客户预报等页面布局：与客户端共用侧栏外壳。
 */
export default async function CustomerDashboardLayout({
  children,
}: CustomerDashboardLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
