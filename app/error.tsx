"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCcw, Home } from "lucide-react";

/**
 * Next.js 错误边界组件：捕获并优雅展示渲染或数据流中的未处理错误。
 * 必须是客户端组件 (Client Component)。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 可以在此处接入错误监控服务
    console.error("捕获到全局错误:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] w-full flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <AlertCircle className="h-10 w-10 text-red-600" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-brand-dark sm:text-3xl">
        抱歉，系统遇到了错误
      </h1>
      
      <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
        页面加载时发生了意外情况。我们的技术团队已经收到相关反馈，请尝试重新加载页面或稍后再试。
      </p>

      {error.digest && (
        <p className="mt-2 text-xs font-mono text-slate-500">
          错误代码: {error.digest}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <RefreshCcw className="h-4 w-4" />
          重试加载
        </button>
        
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Home className="h-4 w-4" />
          返回首页
        </Link>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="mt-12 w-full max-w-2xl overflow-hidden rounded-xl border border-red-100 bg-red-50 p-6 text-left shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-red-800">
            开发环境诊断 (Debug Info):
          </h2>
          <div className="max-h-[300px] overflow-auto rounded bg-white/50 p-3 font-mono text-xs text-red-700">
            <p className="mb-2 font-bold">{error.name}: {error.message}</p>
            <pre className="whitespace-pre-wrap leading-relaxed">
              {error.stack}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
