"use client";

import { usePathname } from "next/navigation";
import { AuthBar } from "@/app/components/AuthBar";

export function GlobalHeader() {
  const pathname = usePathname();

  // 在登录页隐藏顶部导航栏，实现全屏沉浸式背景
  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <p className="text-base font-semibold tracking-wide text-brand">湘泰物流</p>
        <div className="flex flex-1 items-center justify-end gap-6 sm:gap-8">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-slate-600">结算币种</p>
            <p className="text-sm font-medium text-slate-700">人民币（CNY）</p>
          </div>
          <AuthBar />
        </div>
      </div>
    </header>
  );
}
