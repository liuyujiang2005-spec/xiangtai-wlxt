import { Package } from "lucide-react";

/**
 * 海外仓与末端集成占位页，后续可对接海外仓与派送接口。
 */
export default function AdminOverseasIntegrationPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-7 w-7 text-brand" />
        <h1 className="text-xl font-semibold text-brand">海外仓 / 末端集成</h1>
      </div>
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        此模块用于海外仓入库、出库与末端快递/卡车对接。功能开发中。
      </p>
    </main>
  );
}
