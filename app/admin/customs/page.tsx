import { ShieldCheck } from "lucide-react";

/**
 * 关务监控占位页，后续可对接申报状态与查验提醒。
 */
export default function AdminCustomsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-7 w-7 text-brand" />
        <h1 className="text-xl font-semibold text-brand">关务监控</h1>
      </div>
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        此模块用于集中查看报关单证、查验与放行状态。功能开发中。
      </p>
    </main>
  );
}
