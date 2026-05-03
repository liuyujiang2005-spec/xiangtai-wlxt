"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Ship, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCny } from "@/lib/customer/shipment-display";

type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ShipmentRow = {
  id: string;
  trackingNumber: string;
  warehouse: "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
  shippingMethod: "SEA" | "LAND";
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
 * 客户运单列表（ERP 风格）。
 */
export default function CustomerShipmentsPage() {
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pageSize: 50, totalPages: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedQuery, setAppliedQuery] = useState<string>("");

  /**
   * 加载运单列表，支持搜索。
   */
  const load = useCallback(async (pageIndex: number, query: string): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(pageIndex));
      qs.set("pageSize", String(pagination.pageSize));
      if (query) {
        qs.set("query", query);
      }

      const response = await fetch(`/api/client/shipments?${qs.toString()}`, {
        credentials: "include",
      });
      if (response.status === 401) {
        throw new Error("请先登录客户账号。");
      }
      if (!response.ok) {
        throw new Error("加载失败");
      }
      const data = (await response.json()) as { list?: ShipmentRow[]; pagination?: Pagination };
      setRows(data.list ?? []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法加载运单。");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize]);

  useEffect(() => {
    void load(pagination.page, appliedQuery);
  }, [load, pagination.page, appliedQuery]);

  function handleSearch(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const q = searchInput.trim();
    setAppliedQuery(q);
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function handleReset(): void {
    setSearchInput("");
    setAppliedQuery("");
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-10">
      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Ship className="h-7 w-7 shrink-0 text-[#1677ff]" />
          <h1 className="text-base font-semibold text-[rgba(0,0,0,0.88)]">
            运单列表
          </h1>
        </div>
        <p className="mb-3 text-xs text-[rgba(0,0,0,0.45)]">
          预录单号以 YB 开头；待支付金额为系统按体积与单价估算的人民币应付金额（已豁免低消时以实际为准）。
        </p>

        {/* 搜索栏 */}
        <form
          onSubmit={handleSearch}
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="输入运单号 / 唛头 / 国内单号搜索"
            className="h-8 w-64 rounded border border-[#d9d9d9] px-2.5 text-xs outline-none focus:border-[#1677ff] focus:ring-1 focus:ring-[#1677ff]"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-8 rounded border border-[#1677ff] bg-[#1677ff] px-3 text-xs font-medium text-white hover:bg-[#4096ff] disabled:opacity-50"
          >
            查询
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="h-8 rounded border border-[#d9d9d9] bg-white px-3 text-xs font-medium text-[rgba(0,0,0,0.88)] hover:border-[#1677ff] hover:text-[#1677ff] disabled:opacity-50"
          >
            重置
          </button>
          {appliedQuery ? (
            <span className="text-xs text-[rgba(0,0,0,0.45)]">
              搜索：<span className="font-medium text-[rgba(0,0,0,0.65)]">{appliedQuery}</span>
            </span>
          ) : null}
        </form>

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
                      colSpan={9}
                      className="px-3 py-6 text-center text-[rgba(0,0,0,0.45)]"
                    >
                      加载中…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
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

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-[#d9d9d9] bg-white px-4 py-3 sm:px-6">
            <p className="text-sm text-[rgba(0,0,0,0.88)]">
              第 <span className="font-medium">{pagination.page}</span> 页，共 <span className="font-medium">{pagination.totalPages}</span> 页
              <span className="ml-2 text-xs text-[rgba(0,0,0,0.45)]">（共 {pagination.total} 条）</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded border border-[#d9d9d9] px-3 py-1 text-sm font-medium text-[rgba(0,0,0,0.88)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#1677ff] hover:text-[#1677ff]"
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </button>
              <button
                type="button"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="inline-flex items-center gap-1 rounded border border-[#d9d9d9] px-3 py-1 text-sm font-medium text-[rgba(0,0,0,0.88)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#1677ff] hover:text-[#1677ff]"
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
