import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { requirePageSession } from "@/lib/auth/require-page-access";

type PricingLayoutProps = {
  children: ReactNode;
};

/**
 * 报价说明页与业务区共用左侧导航布局。
 */
export default async function PricingLayout({ children }: PricingLayoutProps) {
  const session = await requirePageSession();
  if (session.role === "CLIENT") {
    redirect("/customer/pricing");
  }
  return <AppShell>{children}</AppShell>;
}
