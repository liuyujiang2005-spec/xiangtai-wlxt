"use client";

import { useState } from "react";
import { Search, Package, MapPin, Clock } from "lucide-react";

type History = {
  id?: string;
  status?: string;
  note: string;
  time: string;
  location?: string;
};

type TrackingData = {
  id?: string;
  trackingNumber: string;
  status?: string;
  state?: string;
  shippingMethod?: string;
  warehouse?: string;
  company?: string;
  histories: History[];
};

/** 快递100快递状态码对应文案 */
const KUAIDI_STATE: Record<string, string> = {
  "0": "在途",
  "1": "揽件",
  "2": "疑难",
  "3": "签收",
  "4": "退签",
  "5": "派件",
  "6": "退回",
  "7": "转投",
  "10": "待清关",
  "11": "清关中",
  "12": "已清关",
  "13": "清关异常",
  "14": "收件人拒收",
};

export default function TrackingPage() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ type: "internal" | "external"; data: TrackingData } | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNumber.trim()) return;

    setSearching(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/public/tracking?no=${encodeURIComponent(trackingNumber.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "查询失败");
        return;
      }

      setResult({
        type: data.type,
        data: data.data,
      });
    } catch (err) {
      setError("网络异常，请稍后再试");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-brand-dark tracking-tight">中泰专线物流追踪</h1>
        <p className="mt-3 text-sm text-slate-600">支持查询湘泰内部运单号，以及通过快递100查询国内主流快递单号</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <form onSubmit={handleSearch} className="relative flex items-center shadow-sm rounded-xl overflow-hidden border border-slate-200 bg-white">
          <div className="flex items-center pl-4 pr-2 text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="请输入您的运单号或快递单号"
            className="flex-1 py-4 px-2 text-base outline-none bg-transparent placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={searching || !trackingNumber.trim()}
            className="h-full px-8 py-4 bg-brand-accent text-white font-medium hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? "查询中..." : "查 询"}
          </button>
        </form>
        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="mx-auto mt-10 max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-brand-accent" />
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {result.type === "internal"
                      ? "湘泰物流专线"
                      : result.data.company
                        ? `快递100 · ${result.data.company}`
                        : "第三方快递"}
                  </p>
                  <p className="text-lg font-bold text-brand-dark font-mono">
                    {result.data.trackingNumber}
                  </p>
                </div>
              </div>
              {result.data.state !== undefined && (
                <span className="rounded-full bg-brand-accent/10 px-3 py-1 text-sm font-medium text-brand-accent">
                  {KUAIDI_STATE[result.data.state] ?? result.data.state}
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            {result.data.histories.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-0 top-2 bottom-2 w-px bg-slate-200"></div>
                <div className="space-y-8">
                  {result.data.histories.map((history, idx) => (
                    <div key={history.id || idx} className="relative">
                      <div className={`absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-white ${idx === 0 ? "bg-brand-accent shadow-[0_0_0_2px_rgba(255,140,0,0.2)]" : "bg-slate-300"}`}></div>
                      <p className={`text-base ${idx === 0 ? "font-medium text-brand-dark" : "text-slate-600"}`}>
                        {history.note || `状态更新: ${history.status ?? ""}`}
                      </p>
                      {history.location && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" />
                          <span>{history.location}</span>
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{new Date(history.time).toLocaleString("zh-CN")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 flex flex-col items-center">
                <MapPin className="h-10 w-10 text-slate-300 mb-3" />
                <p>暂无物流轨迹记录</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}