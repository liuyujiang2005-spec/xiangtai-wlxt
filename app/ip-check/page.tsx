"use client";

import { useRef, useState } from "react";
import { Search, ExternalLink, ShieldCheck, Info } from "lucide-react";

const TARGET_BASE =
  "http://202.127.48.145:8888/zscq/search/jsp/vBrandSearchIndex.jsp";

/**
 * 知识产权查询页面。
 * 通过 iframe 嵌入中国海关知识产权保护备案查询系统，并支持在新标签页打开。
 */
export default function IpCheckPage() {
  const [keyword, setKeyword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /** 构建带关键词的查询 URL（常见 JSP 系统参数名） */
  function buildUrl(kw: string): string {
    if (!kw.trim()) return TARGET_BASE;
    const params = new URLSearchParams({ searchTxt: kw.trim() });
    return `${TARGET_BASE}?${params.toString()}`;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  function handleOpenNewTab() {
    window.open(buildUrl(keyword), "_blank", "noopener,noreferrer");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-brand-dark tracking-tight">
          知识产权（海关备案）查询
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          连接中国海关知识产权保护备案查询系统，输入品牌名称查询是否已备案
        </p>
      </div>

      {/* 搜索栏 */}
      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={handleSearch}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="请输入品牌名称（中英文均可，如：NIKE、苹果）"
            className="flex-1 bg-transparent text-base outline-none placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!keyword.trim()}
            className="rounded-lg bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:bg-brand-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            查 询
          </button>
          <button
            type="button"
            title="在新标签页打开"
            onClick={handleOpenNewTab}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-brand-accent/50 hover:text-brand-accent"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </form>

        {/* 快捷提示 */}
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            如下方页面无法加载（目标系统可能限制嵌入），请点击右上角
            <ExternalLink className="mx-1 inline h-3 w-3" />
            按钮在新窗口中打开进行查询。
          </span>
        </div>
      </div>

      {/* 嵌入 iframe */}
      {submitted && (
        <div className="mx-auto mt-5 max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">中国海关知识产权保护备案查询系统</span>
              {keyword && (
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                  {keyword}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-brand-accent/50 hover:text-brand-accent"
            >
              <ExternalLink className="h-3 w-3" />
              新窗口打开
            </button>
          </div>
          <iframe
            ref={iframeRef}
            src={buildUrl(keyword)}
            className="h-[620px] w-full border-0"
            title="中国海关知识产权保护备案查询"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )}

      {/* 未查询时的引导 */}
      {!submitted && (
        <div className="mx-auto mt-8 max-w-2xl">
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm">输入品牌名称后点击「查询」，将在下方嵌入显示官方查询结果</p>
          </div>
        </div>
      )}

      {/* 免责声明 */}
      <div className="mx-auto mt-6 max-w-5xl rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <p className="font-medium text-slate-600">免责声明与查货提示：</p>
        <p className="mt-1">
          1. 查询结果来自中国海关知识产权保护备案系统，仅供参考，不作为最终报关/通关凭证。未查到备案不代表绝对安全。
        </p>
        <p className="mt-1">
          2. 部分品牌在泰国当地已注册商标，即使中国海关无备案，货物抵达泰国仍可能面临知识产权侵权扣关风险。
        </p>
        <p className="mt-1">
          3. 涉及品牌的货物，请务必提供权利人出具的正规授权书或正规渠道购买凭证。仿牌、侵权货物我司将拒绝承运，隐瞒申报产生的一切后果由寄件人承担。
        </p>
      </div>
    </main>
  );
}
