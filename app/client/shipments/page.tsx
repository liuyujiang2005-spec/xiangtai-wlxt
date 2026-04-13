"use client";

import { useCallback, useEffect, useState } from "react";
import { Ship } from "lucide-react";
import { CurrencyAmount } from "@/app/components/CurrencyAmount";

type Row = {
  id: string;
  trackingNumber: string;
  warehouse: "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
  shippingMethod: "SEA" | "LAND";
  actualCBM: number;
  actualWeight: number;
  isMinChargeWaived: boolean;
  isForecastPending: boolean;
  domesticTracking: string | null;
  goodsName: string | null;
  estimatedPieces: number | null;
  charge: { finalCharge: number; minChargeDifferenceFee: number };
  hasMinCompensation: boolean;
};

const WAREHOUSE_LABEL: Record<Row["warehouse"], string> = {
  YIWU: "义乌仓",
  GUANGZHOU: "广州仓",
  SHENZHEN: "深圳仓",
  DONGGUAN: "东莞仓",
};

const METHOD_LABEL: Record<Row["shippingMethod"], string> = {
  SEA: "海运",
  LAND: "陆运",
};

/**
 * 客户「我的运单」只读列表（数据来自客户专用接口）。
 */
export default function ClientShipmentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  /**
   * 加载客户可见运单列表。
   */
  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/client/shipments", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("加载失败");
      }
      const data = (await response.json()) as { list?: Row[] };
      setRows(data.list ?? []);
    } catch {
      setError("无法加载运单，请确认已使用客户账号登录。");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Ship className="h-7 w-7 text-brand" />
        <h1 className="text-xl font-semibold text-brand">我的运单</h1>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        仅展示当前登录账号关联的运单与预报单；预报待入库时体积与费用为占位，入库后将更新。
      </p>

      {error ? (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">加载中…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-left font-medium">单号</th>
                  <th className="px-3 py-3 text-left font-medium">状态</th>
                  <th className="px-3 py-3 text-left font-medium">仓库</th>
                  <th className="px-3 py-3 text-left font-medium">方式</th>
                  <th className="px-3 py-3 text-left font-medium">体积</th>
                  <th className="px-3 py-3 text-left font-medium">重量</th>
                  <th className="px-3 py-3 text-left font-medium">费用</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-100 ${
                      row.isForecastPending ? "bg-slate-50 text-slate-600" : ""
                    }`}
                  >
                    <td className="px-3 py-3 font-medium text-brand">
                      {row.trackingNumber}
                    </td>
                    <td className="px-3 py-3">
                      {row.isForecastPending ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-800">
                          已预报，待入库
                        </span>
                      ) : (
                        <span className="text-slate-700">已入库</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{WAREHOUSE_LABEL[row.warehouse]}</td>
                    <td className="px-3 py-3">{METHOD_LABEL[row.shippingMethod]}</td>
                    <td className="px-3 py-3">{row.actualCBM.toFixed(3)} CBM</td>
                    <td className="px-3 py-3">{row.actualWeight.toFixed(2)} KG</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <CurrencyAmount value={row.charge.finalCharge} />
                        {row.isMinChargeWaived ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-700">
                            已豁免
                          </span>
                        ) : row.hasMinCompensation ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-700">
                            含低消补偿
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-slate-400"
                    >
                      暂无运单数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
