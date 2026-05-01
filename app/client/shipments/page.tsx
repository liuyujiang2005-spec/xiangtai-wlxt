"use client";

import { useCallback, useEffect, useState } from "react";
import { Ship } from "lucide-react";
import Link from "next/link";
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

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 whitespace-nowrap">运单号:</span>
            <input
              placeholder="请输入运单号"
              className="rounded border border-slate-200 px-3 py-1.5 text-sm w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 whitespace-nowrap">国内单号:</span>
            <input
              placeholder="请输入国内单号"
              className="rounded border border-slate-200 px-3 py-1.5 text-sm w-48"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600 flex items-center gap-1"
          >
            查询
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-1"
          >
            重置
          </button>
          <button type="button" className="text-sm text-blue-500 hover:underline flex items-center ml-2">
            展开 ▾
          </button>
        </div>

        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          <Link
            href="/customer/pre-order/new"
            className="rounded bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600 flex items-center gap-1"
          >
            新增
          </Link>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-1"
          >
            导出
          </button>
          <button
            type="button"
            className="rounded bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 border border-blue-200 flex items-center gap-1"
          >
            高级查询
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">加载中…</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded border border-slate-200 bg-white">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-xs">i</div>
            <span className="text-sm text-slate-700">未选中任何数据</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-center font-medium w-12">
                    <input type="checkbox" disabled />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">运单号</th>
                  <th className="px-3 py-3 text-left font-medium">状态</th>
                  <th className="px-3 py-3 text-left font-medium">仓库</th>
                  <th className="px-3 py-3 text-left font-medium">运输方式</th>
                  <th className="px-3 py-3 text-left font-medium">总体积</th>
                  <th className="px-3 py-3 text-left font-medium">总重量</th>
                  <th className="px-3 py-3 text-left font-medium">费用</th>
                  <th className="px-3 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${
                      row.isForecastPending ? "bg-slate-50/50 text-slate-600" : ""
                    }`}
                  >
                    <td className="px-3 py-3 text-center w-12">
                      <input type="checkbox" disabled />
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-700">
                      {row.trackingNumber}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {row.isForecastPending ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                          已预报
                        </span>
                      ) : (
                        <span className="text-slate-700">已入库</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{WAREHOUSE_LABEL[row.warehouse]}</td>
                    <td className="px-3 py-3 text-slate-700">{METHOD_LABEL[row.shippingMethod]}</td>
                    <td className="px-3 py-3 text-slate-700">{row.actualCBM.toFixed(3)} CBM</td>
                    <td className="px-3 py-3 text-slate-700">{row.actualWeight.toFixed(2)} KG</td>
                    <td className="px-3 py-3 text-slate-700">
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
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 text-brand">
                        <button type="button" className="hover:underline">物流轨迹</button>
                        <button type="button" className="hover:underline">更多 ▾</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-8 text-center text-slate-500"
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
