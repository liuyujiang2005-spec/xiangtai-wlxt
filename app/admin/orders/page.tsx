"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Row = {
  id: string;
  trackingNumber: string;
  warehouse: "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
  shipmentStatus:
    | "ORDERED"
    | "PENDING_INBOUND"
    | "INBOUND_CONFIRMED"
    | "LOADED"
    | "SHIPPED"
    | "CUSTOMS_CLEARING"
    | "ARRIVED_TH"
    | "OUT_FOR_DELIVERY"
    | "SIGNED";
  isForecastPending: boolean;
  clientLogin: string | null;
  shippingMark: string | null;
  domesticTracking: string | null;
  containerTruckNo: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const STATUS_OPTIONS: Array<{ value: Row["shipmentStatus"]; label: string }> = [
  { value: "ORDERED", label: "已下单" },
  { value: "INBOUND_CONFIRMED", label: "已入库" },
  { value: "LOADED", label: "已装柜" },
  { value: "CUSTOMS_CLEARING", label: "清关中" },
  { value: "ARRIVED_TH", label: "到达泰国" },
  { value: "OUT_FOR_DELIVERY", label: "待派送" },
  { value: "SIGNED", label: "已签收" },
];

const STATUS_LABEL: Record<Row["shipmentStatus"], string> = {
  ORDERED: "已下单",
  PENDING_INBOUND: "待入库",
  INBOUND_CONFIRMED: "已入库",
  LOADED: "已装柜",
  SHIPPED: "已发货",
  CUSTOMS_CLEARING: "清关中",
  ARRIVED_TH: "到达泰国",
  OUT_FOR_DELIVERY: "待派送",
  SIGNED: "已签收",
};

/**
 * 将 fetch 的 Response 解析为 JSON；空体或非 JSON 时抛出可读错误（避免 response.json() 报 Unexpected end of JSON input）。
 */
async function readResponseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      `服务器返回空内容（HTTP ${response.status}）。常见于网关超时、实例未就绪或部署异常，请稍后重试。`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `服务器返回非 JSON（HTTP ${response.status}）。请确认已登录且接口未被代理返回 HTML 错误页。`
    );
  }
}

/**
 * 全局订单审计：管理员查看全部分仓订单并强制修改状态。
 */
export default function AdminOrdersPage(): React.ReactNode {
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pageSize: 50, totalPages: 0 });
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Row["shipmentStatus"] | "ALL">(
    "ALL"
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [truckNo, setTruckNo] = useState("");

  /**
   * 调度看板统计：各状态数量与今日待派送。
   */
  const statusStats = useMemo(() => {
    const byStatus: Record<Row["shipmentStatus"], number> = {
      ORDERED: 0,
      PENDING_INBOUND: 0,
      INBOUND_CONFIRMED: 0,
      LOADED: 0,
      SHIPPED: 0,
      CUSTOMS_CLEARING: 0,
      ARRIVED_TH: 0,
      OUT_FOR_DELIVERY: 0,
      SIGNED: 0,
    };
    for (const row of rows) {
      byStatus[row.shipmentStatus] += 1;
    }
    
    function isTodayLocal(iso?: string): boolean {
      if (!iso) return false;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return false;
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }

    const todayOutForDelivery = rows.filter(
      (r) => r.shipmentStatus === "OUT_FOR_DELIVERY" && isTodayLocal(r.updatedAt)
    ).length;
    return { byStatus, todayOutForDelivery };
  }, [rows]);

  /**
   * 拉取全局正式运单，可按客户/唛头/国内单号/车号/单号搜索。
   */
  const load = useCallback(async (pageIndex: number): Promise<void> => {
    setError("");
    try {
      const qs = new URLSearchParams();
      if (query.trim()) {
        qs.set("query", query.trim());
      }
      qs.set("page", String(pageIndex));
      qs.set("pageSize", String(pagination.pageSize));

      const url = `/api/transport-bills?${qs.toString()}`;
      const response = await fetch(url, { credentials: "include" });
      const data = await readResponseJson<{ list?: Row[]; message?: string; pagination?: Pagination }>(
        response
      );
      if (!response.ok) {
        throw new Error(data.message ?? "加载失败");
      }
      setRows((data.list ?? []).filter((r) => !r.isForecastPending));
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setRows([]);
    }
  }, [query, pagination.pageSize]);

  useEffect(() => {
    void load(pagination.page);
  }, [load, pagination.page]);

  /**
   * 当前筛选结果（状态过滤）。
   */
  const filteredRows =
    statusFilter === "ALL"
      ? rows
      : rows.filter((r) => r.shipmentStatus === statusFilter);

  /**
   * 修改正式单状态并刷新显示。
   */
  async function updateStatus(id: string, status: Row["shipmentStatus"]): Promise<void> {
    setSavingId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/transport-bills/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentStatus: status,
          containerTruckNo: truckNo.trim() || undefined,
        }),
      });
      const data = await readResponseJson<{ message?: string; bill?: Row }>(
        response
      );
      if (!response.ok || !data.bill) {
        throw new Error(data.message ?? "修改失败");
      }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, shipmentStatus: data.bill!.shipmentStatus } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "修改失败");
    } finally {
      setSavingId("");
    }
  }

  /**
   * 批量将选中运单一键改为“已装柜”。
   */
  async function batchToLoaded(): Promise<void> {
    const validIds = selectedIds.filter((id) =>
      filteredRows.some((r) => r.id === id)
    );
    if (validIds.length === 0) {
      setError("请先勾选需要批量改态的运单。");
      return;
    }
    setBatchLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/transport-bills/batch-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: validIds,
          containerTruckNo: truckNo.trim() || undefined,
        }),
      });
      const data = await readResponseJson<{ message?: string }>(response);
      if (!response.ok) {
        throw new Error(data.message ?? "批量更新失败");
      }
      setSelectedIds([]);
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量更新失败");
    } finally {
      setBatchLoading(false);
    }
  }

  /**
   * 切换全选/取消全选。
   */
  function toggleSelectAll(checked: boolean): void {
    setSelectedIds(checked ? filteredRows.map((r) => r.id) : []);
  }

  /**
   * 导出当前筛选结果 CSV。
   */
  function exportCsv(): void {
    const header = [
      "单号",
      "客户",
      "唛头",
      "国内快递号",
      "装柜车号",
      "仓库",
      "状态",
    ];
    const lines = filteredRows.map((r) =>
      [
        r.trackingNumber,
        r.clientLogin ?? "",
        r.shippingMark ?? "",
        r.domesticTracking ?? "",
        r.containerTruckNo ?? "",
        r.warehouse,
        STATUS_LABEL[r.shipmentStatus] ?? r.shipmentStatus,
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",")
    );
    const csvText = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`\uFEFF${csvText}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-brand">全局订单审计</h1>
      <p className="mt-2 text-sm text-slate-600">管理员可跨仓库调度状态，并支持批量一键改为“已装柜”。</p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("ALL");
            setSelectedIds([]);
          }}
          className={`rounded-2xl border p-3 text-left ${
            statusFilter === "ALL"
              ? "border-brand/50 bg-indigo-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-xs text-slate-500">全部运单</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{rows.length}</p>
        </button>
        {STATUS_OPTIONS.map((o) => (
          <button
            type="button"
            key={o.value}
            onClick={() => {
              setStatusFilter(o.value);
              setSelectedIds([]);
            }}
            className={`rounded-2xl border p-3 text-left ${
              statusFilter === o.value
                ? "border-brand/50 bg-indigo-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs text-slate-500">{o.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {statusStats.byStatus[o.value]}
            </p>
          </button>
        ))}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">今日待派送（高优先）</p>
          <p className="mt-1 text-xl font-semibold text-amber-900">
            {statusStats.todayOutForDelivery}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="搜客户名/唛头/国内快递号/装柜车号/单号"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          value={truckNo}
          onChange={(e) => {
            setTruckNo(e.target.value);
          }}
          placeholder="批量装柜车号（可选）"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={rows.length === 0 && !query.trim()}
            onClick={() => {
              if (pagination.page !== 1) {
                setPagination(prev => ({ ...prev, page: 1 }));
              } else {
                void load(1);
              }
            }}
            className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          >
            搜索
          </button>
          <button
            type="button"
            disabled={batchLoading || selectedIds.length === 0}
            onClick={() => {
              void batchToLoaded();
            }}
            className="rounded border border-brand/30 px-3 py-2 text-sm font-medium text-brand disabled:opacity-50"
          >
            {batchLoading ? "批量处理中..." : "一键改为已装柜"}
          </button>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as Row["shipmentStatus"] | "ALL");
              setSelectedIds([]);
            }}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="ALL">全部状态</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            导出当前筛选
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                <input
                  type="checkbox"
                  checked={
                    filteredRows.length > 0 &&
                    selectedIds.length === filteredRows.length
                  }
                  onChange={(e) => {
                    toggleSelectAll(e.target.checked);
                  }}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium">单号</th>
              <th className="px-3 py-2 text-left font-medium">客户</th>
              <th className="px-3 py-2 text-left font-medium">唛头</th>
              <th className="px-3 py-2 text-left font-medium">国内单号</th>
              <th className="px-3 py-2 text-left font-medium">装柜车号</th>
              <th className="px-3 py-2 text-left font-medium">仓库</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">强制修改</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr
                  key={r.id}
                  className={`border-t border-slate-100 ${
                    r.shipmentStatus === "OUT_FOR_DELIVERY" &&
                    (() => {
                      const d = new Date(r.updatedAt || "");
                      if (Number.isNaN(d.getTime())) return false;
                      const now = new Date();
                      return (
                        d.getFullYear() === now.getFullYear() &&
                        d.getMonth() === now.getMonth() &&
                        d.getDate() === now.getDate()
                      );
                    })()
                      ? "bg-amber-50/70"
                      : ""
                  }`}
                >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={(e) => {
                      setSelectedIds((prev) =>
                        e.target.checked
                          ? [...prev, r.id]
                          : prev.filter((id) => id !== r.id)
                      );
                    }}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-brand">{r.trackingNumber}</td>
                <td className="px-3 py-2">{r.clientLogin ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{r.shippingMark ?? "—"}</td>
                <td className="px-3 py-2">{r.domesticTracking ?? "—"}</td>
                <td className="px-3 py-2">{r.containerTruckNo ?? "—"}</td>
                <td className="px-3 py-2">{r.warehouse}</td>
                <td className="px-3 py-2">{STATUS_LABEL[r.shipmentStatus] ?? r.shipmentStatus}</td>
                <td className="px-3 py-2">
                  <select
                    value={r.shipmentStatus}
                    onChange={(e) => {
                      void updateStatus(r.id, e.target.value as Row["shipmentStatus"]);
                    }}
                    disabled={savingId === r.id}
                    className="rounded border border-slate-200 px-2 py-1"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  暂无正式运单
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <p className="text-sm text-slate-700">
            第 <span className="font-medium">{pagination.page}</span> 页，共 <span className="font-medium">{pagination.totalPages}</span> 页
            <span className="ml-2 text-xs text-slate-500">（共 {pagination.total} 条）</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>
            <button
              type="button"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
