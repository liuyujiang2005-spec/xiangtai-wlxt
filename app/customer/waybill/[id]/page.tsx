"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";

type BillPayload = {
  trackingNumber: string;
  warehouse: string;
  shippingMethod: string;
  destinationCountry: string;
  remark: string | null;
  shippingMark: string | null;
  totalPackages: number | null;
  createdAt: string;
};

const WAREHOUSE_LABEL: Record<string, string> = {
  YIWU: "义乌仓",
  GUANGZHOU: "广州仓",
  SHENZHEN: "深圳仓",
  DONGGUAN: "东莞仓",
};

const SHIPPING_LABEL: Record<string, string> = {
  SEA: "海运",
  LAND: "陆运",
};

/**
 * 根据总件数解析打印张数与箱号分母（未填或 ≤0 时仅打 1 张，分母按 1 显示）。
 */
function resolveWaybillPrintSpec(totalPackages: number | null): {
  sheetCount: number;
  boxTotal: number;
  missingTotal: boolean;
} {
  if (typeof totalPackages === "number" && totalPackages > 0) {
    return {
      sheetCount: totalPackages,
      boxTotal: totalPackages,
      missingTotal: false,
    };
  }
  return { sheetCount: 1, boxTotal: 1, missingTotal: true };
}

/**
 * 面单打印页：按总件数分页，每页显示「总件数-当前箱号」；浏览器打印支持分页与另存 PDF。
 */
export default function WaybillPrintPage(): React.ReactNode {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [bill, setBill] = useState<BillPayload | null>(null);
  const [markDisplay, setMarkDisplay] = useState<string>("");

  /**
   * 拉取运单详情用于面单展示。
   */
  const load = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/client/bills/${id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(data.message ?? "加载失败");
      }
      const data = (await response.json()) as {
        bill: BillPayload;
        markDisplay?: string;
      };
      setBill(data.bill);
      setMarkDisplay(data.markDisplay ?? data.bill.shippingMark ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setBill(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const printSpec = useMemo(
    () => (bill ? resolveWaybillPrintSpec(bill.totalPackages) : null),
    [bill]
  );

  const sheetIndices = useMemo(() => {
    if (!printSpec) {
      return [];
    }
    return Array.from({ length: printSpec.sheetCount }, (_, i) => i + 1);
  }, [printSpec]);

  /**
   * 触发系统打印对话框（可另存为 PDF，按面单页数分页）。
   */
  const handlePrint = useCallback((): void => {
    window.print();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        加载中…
      </div>
    );
  }

  if (error || !bill || !printSpec) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-red-600">
        {error || "无法加载面单"}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .waybill-sheet {
            box-shadow: none !important;
            border: none !important;
            min-height: 0;
          }
          .waybill-print-page {
            page-break-after: always;
            break-after: page;
          }
          .waybill-print-page:last-of-type {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
      <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
        <div className="no-print mx-auto mb-4 flex max-w-3xl flex-col items-end gap-1 px-4 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-xs text-slate-500">
            共 {printSpec.sheetCount} 张面单
            {printSpec.missingTotal
              ? "（未填写总件数，已按 1 张打印；补全件数后可分页箱号）"
              : "（按件数 总-序号 分页）"}
          </p>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1677ff] px-4 py-2 text-sm font-medium text-white hover:bg-[#4096ff]"
          >
            <Printer className="h-4 w-4" />
            打印 / 另存为 PDF
          </button>
        </div>

        {sheetIndices.map((boxIndex) => (
          <div
            key={boxIndex}
            className="waybill-print-page waybill-sheet mx-auto mb-8 max-w-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm print:mx-0 print:mb-0 print:max-w-none print:border-0 print:px-8 print:py-10"
          >
            <header className="border-b border-slate-200 pb-4 text-center">
              <p className="text-sm font-semibold tracking-wide text-slate-800">
                湘泰物流 · 入库面单
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {bill.trackingNumber}
              </p>
            </header>

            <section className="mt-6 flex flex-col items-center justify-center rounded-lg border-2 border-slate-900 bg-slate-50 py-6 print:border-black print:bg-white print:py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 print:text-slate-700">
                箱号 CARTON
              </p>
              <p
                className="mt-2 text-center font-mono font-black tabular-nums leading-none tracking-tight text-slate-900"
                style={{
                  fontSize: "clamp(3rem, 14vw, 5.5rem)",
                  lineHeight: 1.05,
                }}
              >
                {`${printSpec.boxTotal}-${boxIndex}`}
              </p>
              <p className="mt-2 font-mono text-sm text-slate-500">
                第 {boxIndex} 箱 / 共 {printSpec.boxTotal} 箱
                {printSpec.missingTotal ? "（订单未填总件数，暂按 1 箱）" : ""}
              </p>
            </section>

            <section className="mt-8 flex flex-col items-center justify-center border-y-2 border-slate-900 py-10 print:border-black print:py-12">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500 print:text-slate-600">
                唛头 MARK
              </p>
              <p
                className="mt-3 text-center font-mono text-5xl font-black leading-none tracking-tight text-slate-900 print:text-6xl print:font-black"
                style={{ fontSize: "clamp(2rem, 8vw, 3.75rem)" }}
              >
                {markDisplay || "—"}
              </p>
            </section>

            <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-slate-800">
              <div>
                <dt className="text-xs text-slate-500">仓库</dt>
                <dd className="mt-0.5 font-medium">
                  {WAREHOUSE_LABEL[bill.warehouse] ?? bill.warehouse}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">运输方式</dt>
                <dd className="mt-0.5 font-medium">
                  {SHIPPING_LABEL[bill.shippingMethod] ?? bill.shippingMethod}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">目的国家</dt>
                <dd className="mt-0.5 font-medium">{bill.destinationCountry}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">总件数</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {bill.totalPackages ?? "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">备注</dt>
                <dd className="mt-0.5">{bill.remark?.trim() || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">预报时间</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-600">
                  {new Date(bill.createdAt).toLocaleString("zh-CN", {
                    hour12: false,
                  })}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
