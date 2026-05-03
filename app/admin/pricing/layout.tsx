import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { requirePageSession } from "@/lib/auth/require-page-access";

export default async function AdminPricingLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession();
  if (session.role !== "ADMIN") {
    redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}
