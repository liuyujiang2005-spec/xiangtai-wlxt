import type { ReactNode } from "react";
import { AppShell } from "@/app/components/AppShell";

export default function IpCheckLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}