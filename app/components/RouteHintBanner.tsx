"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * 根据路由查询参数展示一次性访问提示。
 */
export function RouteHintBanner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (pathname === "/login" || error !== "forbidden") {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <div className="mx-auto w-full max-w-6xl">
        当前账号无权访问刚才的页面，已为你跳转到可访问区域。
      </div>
    </div>
  );
}
