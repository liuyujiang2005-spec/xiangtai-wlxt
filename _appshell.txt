"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/app/components/Sidebar";

type AppShellProps = {
  children: ReactNode;
};

/**
 * 登录后业务区外壳：左侧固定竖向导航 + 右侧主内容区。
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-[calc(100vh-57px)] w-full flex-row">
      <Sidebar />
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto bg-slate-50">
        {children}
      </div>
    </div>
  );
}
