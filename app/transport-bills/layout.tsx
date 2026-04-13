import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";

type TransportBillsLayoutProps = {
  children: ReactNode;
};

/**
 * 运单模块布局：管理员与员工共用侧边导航。
 */
export default function TransportBillsLayout({
  children,
}: TransportBillsLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
