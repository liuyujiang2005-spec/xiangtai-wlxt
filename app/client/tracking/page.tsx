"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";

/**
 * 物流轨迹查询页（占位：展示查询表单，后续可对接轨迹接口）。
 */
export default function ClientTrackingPage() {
  const [trackingNumber, setTrackingNumber] = useState<string>("");

  /**
   * 提交查询占位逻辑，后续可改为请求轨迹 API。
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    // 预留：接入第三方或自建轨迹接口
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <MapPin className="h-7 w-7 text-brand" />
        <h1 className="text-xl font-semibold text-brand">物流轨迹</h1>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        输入运单号查询物流节点（功能预留，当前为界面占位）。
      </p>
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">运单号</span>
          <input
            type="text"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            placeholder="例如 XTYW2604110001"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
          />
        </label>
        <button
          type="submit"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-medium text-white"
        >
          <Search className="h-4 w-4" />
          查询轨迹
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-400">
        轨迹结果将在此区域展示
      </p>
    </main>
  );
}
