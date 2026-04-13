import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";

type CustomerLayoutProps = {
  children: ReactNode;
};

/**
 * 客户预报等页面布局：与客户端共用侧栏外壳。
 */
export default function CustomerLayout({ children }: CustomerLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
