import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";
import { requirePageRole } from "@/lib/auth/require-page-access";

type ClientLayoutProps = {
  children: ReactNode;
};

/**
 * 客户区布局：带角色侧边导航。
 */
export default async function ClientLayout({ children }: ClientLayoutProps) {
  await requirePageRole(["CLIENT"]);
  return <AppShell>{children}</AppShell>;
}
