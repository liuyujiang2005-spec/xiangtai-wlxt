import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";

type PricingLayoutProps = {
  children: ReactNode;
};

/**
 * 报价说明页与业务区共用左侧导航布局。
 */
export default function PricingLayout({ children }: PricingLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
