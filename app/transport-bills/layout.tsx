import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";
import { requireWarehousePageAccess } from "@/lib/auth/require-page-access";

type TransportBillsLayoutProps = {
  children: ReactNode;
};

/**
 * 运单模块布局：管理员与员工共用侧边导航。
 */
export default async function TransportBillsLayout({
  children,
}: TransportBillsLayoutProps) {
  await requireWarehousePageAccess();
  return <AppShell>{children}</AppShell>;
}
