"use client";

import { useState } from "react";
import { Search, ShieldAlert, ShieldCheck, FileWarning, HelpCircle } from "lucide-react";

type Record = {
  recordNo: string;
  brand: string;
  category: string;
  owner: string;
  validUntil: string;
  status: string;
  warning: string;
};

type Result = {
  isRegistered: boolean;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  records: Record[];
  warning?: string;
};

export default function IpCheckPage() {
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;

    setSearching(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/public/ip-check?q=${encodeURIComponent(keyword.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "查询失败");
        return;
      }

      setResult(data.data);
    } catch (err) {
      setError("网络异常，请稍后再试");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-brand-dark tracking-tight">知识产权（海关备案）查询</h1>
        <p className="mt-3 text-sm text-slate-600">查询品牌或商标是否已在海关进行知识产权备案，规避侵权扣关风险</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <form onSubmit={handleSearch} className="relative flex items-center shadow-sm rounded-xl overflow-hidden border border-slate-200 bg-white">
          <div className="flex items-center pl-4 pr-2 text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="请输入品牌名称或商标关键词（例如：Apple、Nike）"
            className="flex-1 py-4 px-2 text-base outline-none bg-transparent placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={searching || !keyword.trim()}
            className="h-full px-8 py-4 bg-brand-accent text-white font-medium hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? "查询中..." : "查 询"}
          </button>
        </form>
        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="mx-auto mt-10 max-w-2xl">
          <div className={`rounded-xl border overflow-hidden bg-white shadow-sm ${
            result.riskLevel === "HIGH" ? "border-red-200" :
            result.riskLevel === "MEDIUM" ? "border-amber-200" :
            "border-emerald-200"
          }`}>
            <div className={`px-6 py-4 flex items-center gap-3 border-b ${
              result.riskLevel === "HIGH" ? "bg-red-50 border-red-100 text-red-700" :
              result.riskLevel === "MEDIUM" ? "bg-amber-50 border-amber-100 text-amber-700" :
              "bg-emerald-50 border-emerald-100 text-emerald-700"
            }`}>
              {result.riskLevel === "HIGH" ? <ShieldAlert className="h-6 w-6" /> :
               result.riskLevel === "MEDIUM" ? <FileWarning className="h-6 w-6" /> :
               <ShieldCheck className="h-6 w-6" />}
              <h2 className="text-lg font-semibold">
                {result.riskLevel === "HIGH" ? "高风险：查到海关备案记录！" :
                 result.riskLevel === "MEDIUM" ? "中风险：有相关备案记录" :
                 "低风险：未查询到海关备案记录"}
              </h2>
            </div>
            
            <div className="p-6">
              {result.records.length > 0 ? (
                <div className="space-y-6">
                  {result.records.map((record, idx) => (
                    <div key={idx} className="space-y-3 text-sm">
                      <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
                        <span className="text-slate-500 font-medium">备案号：</span>
                        <span className="col-span-2 font-mono text-brand-dark">{record.recordNo}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
                        <span className="text-slate-500 font-medium">涉及品牌/商标：</span>
                        <span className="col-span-2 font-semibold">{record.brand}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
                        <span className="text-slate-500 font-medium">权利人：</span>
                        <span className="col-span-2">{record.owner}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
                        <span className="text-slate-500 font-medium">保护商品类别：</span>
                        <span className="col-span-2">{record.category}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
                        <span className="text-slate-500 font-medium">有效期至：</span>
                        <span className="col-span-2">{record.validUntil}</span>
                      </div>
                      <div className="mt-4 rounded-lg bg-red-50 p-3 flex gap-2 text-red-700">
                        <ShieldAlert className="h-5 w-5 shrink-0" />
                        <span>{record.warning}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-600">
                  <p>{result.warning}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 rounded-lg bg-slate-50 p-4 border border-slate-200 text-xs text-slate-500 flex gap-3 items-start">
            <HelpCircle className="h-5 w-5 shrink-0 text-slate-400" />
            <div className="space-y-2">
              <p className="font-medium text-slate-700">免责声明与查货提示：</p>
              <p>1. 此查询结果仅供参考，不作为最终报关/通关凭证。海关备案数据存在滞后性，未查到备案不代表绝对安全。</p>
              <p>2. 部分品牌在目的国当地已注册商标，即使中国海关无备案，到达目的国仍可能面临知识产权侵权扣关的风险。</p>
              <p>3. 涉及品牌的货物，请务必提供权利人出具的正规《授权书》或在正规渠道购买的《增值税发票》。对于仿牌、侵权货物，我司将拒绝承运，隐瞒申报产生的一切后果及罚款由寄件人承担。</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}