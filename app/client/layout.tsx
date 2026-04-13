import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";

type ClientLayoutProps = {
  children: ReactNode;
};

/**
 * 客户区布局：带角色侧边导航。
 */
export default function ClientLayout({ children }: ClientLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
