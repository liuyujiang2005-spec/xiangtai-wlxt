"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Ship } from "lucide-react";
import { formatCny } from "@/lib/customer/shipment-display";

type ShipmentRow = {
  id: string;
  trackingNumber: string;
  warehouse: "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
  shippingMethod: "SEA" | "LAND";
  destinationCountry: string;
  statusLabel: string;
  shippingMark: string;
  totalPackages: number | null;
  createdAt: string;
  pendingAmount: number;
  isForecastPending: boolean;
};

const WAREHOUSE_LABEL: Record<ShipmentRow["warehouse"], string> = {
  YIWU: "义乌仓",
  GUANGZHOU: "广州仓",
  SHENZHEN: "深圳仓",
  DONGGUAN: "东莞仓",
};

const METHOD_LABEL: Record<ShipmentRow["shippingMethod"], string> = {
  SEA: "海运",
  LAND: "陆运",
};

/**
 * 下单时间格式化（YYYY-MM-DD HH:mm:ss）。
 */
function formatOrderTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return "—";
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}:${s}`;
  } catch {
    return "—";
  }
}

/**
 * 客户「我的运单」高密度列表（ERP 风格）。
 */
export default function CustomerShipmentsPage() {
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  /**
   * 加载运单列表。
   */
  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/client/shipments", {
        credentials: "include",
      });
      if (response.status === 401) {
        throw new Error("请先登录客户账号。");
      }
      if (!response.ok) {
        throw new Error("加载失败");
      }
      const data = (await response.json()) as { list?: ShipmentRow[] };
      setRows(data.list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法加载运单。");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-10">
      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Ship className="h-7 w-7 shrink-0 text-[#1677ff]" />
          <h1 className="text-base font-semibold text-[rgba(0,0,0,0.88)]">
            我的运单
          </h1>
        </div>
        <p className="mb-3 text-xs text-[rgba(0,0,0,0.45)]">
          预录单号以 YB 开头；待支付金额为系统按体积与单价估算的人民币应付金额（已豁免低消时以实际为准）。
        </p>

        {error ? (
          <p className="mb-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-[#d9d9d9] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-[11px] leading-tight text-[rgba(0,0,0,0.88)]">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="px-1.5 py-1 font-medium">预录单号</th>
                  <th className="px-1.5 py-1 font-medium">唛头</th>
                  <th className="px-1.5 py-1 font-medium">运输方式</th>
                  <th className="min-w-[132px] px-1.5 py-1 font-medium">
                    下单时间
                  </th>
                  <th className="px-1.5 py-1 font-medium">目的国家</th>
                  <th className="px-1.5 py-1 font-medium">仓库</th>
                  <th className="px-1.5 py-1 font-medium">状态</th>
                  <th className="px-1.5 py-1 font-medium text-right">总件数</th>
                  <th className="min-w-[88px] px-1.5 py-1 font-medium text-right">
                    待支付金额
                  </th>
                  <th className="px-1.5 py-1 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-6 text-center text-[rgba(0,0,0,0.45)]"
                    >
                      加载中…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-6 text-center text-[rgba(0,0,0,0.45)]"
                    >
                      暂无运单数据
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-[#f0f0f0] hover:bg-[#fafafa] ${
                        row.isForecastPending ? "bg-[#fafafa]" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-1.5 py-px font-mono text-[#1677ff]">
                        {row.trackingNumber}
                      </td>
                      <td className="max-w-[100px] truncate px-1.5 py-px font-mono text-xs">
                        {row.shippingMark}
                      </td>
                      <td className="px-1.5 py-px">
                        {METHOD_LABEL[row.shippingMethod]}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-px text-[rgba(0,0,0,0.65)]">
                        {formatOrderTime(row.createdAt)}
                      </td>
                      <td className="px-1.5 py-px">
                        {(row.destinationCountry ?? "").trim() || "泰国"}
                      </td>
                      <td className="px-1.5 py-px">
                        {WAREHOUSE_LABEL[row.warehouse]}
                      </td>
                      <td className="px-1.5 py-px">
                        <span className="inline-block rounded border border-[#d9d9d9] bg-white px-1.5 py-px text-[10px]">
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-1.5 py-px text-right tabular-nums">
                        {row.totalPackages ?? "—"}
                      </td>
                      <td className="px-1.5 py-px text-right font-medium tabular-nums text-[rgba(0,0,0,0.88)]">
                        {formatCny(row.pendingAmount)}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-px">
                        <Link
                          href={`/customer/shipments/${encodeURIComponent(row.id)}`}
                          className="text-[#1677ff] hover:text-[#4096ff]"
                        >
                          详情
                        </Link>
                        <span className="mx-1 text-[#d9d9d9]">|</span>
                        <Link
                          href={`/customer/waybill/${encodeURIComponent(row.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1677ff] hover:text-[#4096ff]"
                        >
                          面单
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
