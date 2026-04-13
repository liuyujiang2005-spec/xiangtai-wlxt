"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { getClientShipmentStatusLabel } from "@/lib/customer/shipment-display";

type Warehouse = "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
type ShippingMethod = "SEA" | "LAND";
type PreOrderStatus = "PRE_ALERT" | "ARRIVED_FULL" | "SHIPPED";

type ForecastRow = {
  id: string;
  trackingNumber: string;
  warehouse: Warehouse;
  shippingMark: string | null;
  shippingMethod: ShippingMethod;
  createdAt: string;
  preOrderStatus: PreOrderStatus;
  totalPackages: number | null;
  isForecastPending: boolean;
};

type ApiResponse = {
  list: ForecastRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const WAREHOUSE_FILTER: { value: Warehouse | ""; label: string }[] = [
  { value: "", label: "全部仓库" },
  { value: "YIWU", label: "义乌仓" },
  { value: "GUANGZHOU", label: "广州仓" },
  { value: "SHENZHEN", label: "深圳仓" },
  { value: "DONGGUAN", label: "东莞仓" },
];

const SHIPPING_LABEL: Record<ShippingMethod, string> = {
  SEA: "海运",
  LAND: "陆运",
};

/** 列表与筛选项中仓库的中文展示 */
const WAREHOUSE_LABEL: Record<Warehouse, string> = {
  YIWU: "义乌仓",
  GUANGZHOU: "广州仓",
  SHENZHEN: "深圳仓",
  DONGGUAN: "东莞仓",
};

const AD_PRIMARY = "bg-[#1677ff] hover:bg-[#4096ff]";

/**
 * 预报时间格式化为 YYYY-MM-DD HH:mm:ss。
 */
function formatForecastTime(iso: string): string {
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
 * 运单预报首页：列表为主，「+ 新增预报」进入子页表单。
 */
function CustomerPreOrderListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState("");
  const [warehouse, setWarehouse] = useState<Warehouse | "">("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginName, setLoginName] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const submitted = searchParams.get("submitted") === "1";

  /**
   * 当前登录名（唛头展示回退）。
   */
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          user?: { username?: string } | null;
        };
        setLoginName(data.user?.username ?? null);
      } catch {
        setLoginName(null);
      }
    })();
  }, []);

  /**
   * 提交成功后由子页带回参数：刷新列表并去掉 URL 参数。
   */
  useEffect(() => {
    if (submitted) {
      setRefreshToken((t) => t + 1);
      router.replace("/customer/pre-order", { scroll: false });
    }
  }, [submitted, router]);

  const filters = useMemo(
    () => ({ queryInput, warehouse, page, pageSize }),
    [queryInput, warehouse, page, pageSize]
  );

  /**
   * 拉取预报列表。
   */
  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.queryInput.trim()) {
        params.set("query", filters.queryInput.trim());
      }
      if (filters.warehouse) {
        params.set("warehouse", filters.warehouse);
      }
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));

      const response = await fetch(`/api/client/forecast-bills?${params}`, {
        credentials: "include",
      });
      if (response.status === 401) {
        setError("请先登录客户账号。");
        setRows([]);
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(data.message ?? "加载失败");
      }
      const data = (await response.json()) as ApiResponse;
      setRows(data.list);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters, refreshToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /**
   * 搜索 / 筛选后回到第一页并重新请求。
   */
  const handleSearch = useCallback((): void => {
    setPage(1);
    setRefreshToken((t) => t + 1);
  }, []);

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-10">
      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-[rgba(0,0,0,0.88)]">
            运单预报
          </h1>
          <Link
            href="/customer/pre-order/new"
            className={`inline-flex h-8 items-center gap-1 rounded px-4 text-xs font-medium text-white ${AD_PRIMARY}`}
          >
            <Plus className="h-3.5 w-3.5" />
            新增预报
          </Link>
        </div>

        <div className="mb-3 flex flex-nowrap items-end gap-3 overflow-x-auto rounded-lg border border-[#d9d9d9] bg-white px-4 py-3 shadow-sm">
          <label className="flex shrink-0 flex-col gap-1">
            <span className="whitespace-nowrap text-xs text-[rgba(0,0,0,0.45)]">
              单号
            </span>
            <input
              value={queryInput}
              onChange={(e) => {
                setQueryInput(e.target.value);
              }}
              placeholder="请输入预录单号"
              className="h-8 w-[200px] rounded border border-[#d9d9d9] px-2 text-xs outline-none focus:border-[#1677ff]"
            />
          </label>
          <label className="flex shrink-0 flex-col gap-1">
            <span className="whitespace-nowrap text-xs text-[rgba(0,0,0,0.45)]">
              仓库
            </span>
            <select
              value={warehouse}
              onChange={(e) => {
                setWarehouse(e.target.value as Warehouse | "");
              }}
              className="h-8 w-[140px] rounded border border-[#d9d9d9] bg-white px-2 text-xs outline-none focus:border-[#1677ff]"
            >
              {WAREHOUSE_FILTER.map((o) => (
                <option key={o.label + String(o.value)} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleSearch}
            className={`ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded px-4 text-xs font-medium text-white ${AD_PRIMARY}`}
          >
            <Search className="h-3.5 w-3.5" />
            查询
          </button>
        </div>

        {error ? (
          <p className="mb-2 text-xs text-red-600">{error}</p>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-[#d9d9d9] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-[11px] leading-tight text-[rgba(0,0,0,0.88)]">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="px-1.5 py-1 font-medium">单号</th>
                  <th className="w-[72px] px-1.5 py-1 font-medium">仓库</th>
                  <th className="px-1.5 py-1 font-medium">唛头</th>
                  <th className="px-1.5 py-1 font-medium">运输方式</th>
                  <th className="min-w-[132px] px-1.5 py-1 font-medium">
                    下单时间
                  </th>
                  <th className="px-1.5 py-1 font-medium">状态</th>
                  <th className="w-14 px-1.5 py-1 font-medium text-right">
                    件数
                  </th>
                  <th className="min-w-[120px] px-1.5 py-1 font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-[rgba(0,0,0,0.45)]"
                    >
                      加载中…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-8 text-center text-[rgba(0,0,0,0.45)]"
                    >
                      暂无预报记录，点击右上角「新增预报」创建。
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const mark = row.shippingMark ?? loginName ?? "—";
                    const statusText = getClientShipmentStatusLabel({
                      isForecastPending: row.isForecastPending,
                      preOrderStatus: row.preOrderStatus,
                    });
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[#f0f0f0] hover:bg-[#fafafa]"
                      >
                        <td className="whitespace-nowrap px-1.5 py-px font-mono text-[#1677ff]">
                          {row.trackingNumber}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-px text-[rgba(0,0,0,0.88)]">
                          {WAREHOUSE_LABEL[row.warehouse] ?? row.warehouse}
                        </td>
                        <td className="max-w-[100px] truncate px-1.5 py-px font-mono text-xs">
                          {mark}
                        </td>
                        <td className="px-1.5 py-px">
                          {SHIPPING_LABEL[row.shippingMethod]}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-px text-[rgba(0,0,0,0.65)]">
                          {formatForecastTime(row.createdAt)}
                        </td>
                        <td className="px-1.5 py-px">
                          <span className="inline-block rounded border border-[#f0f0f0] bg-white px-1.5 py-px text-[10px]">
                            {statusText}
                          </span>
                        </td>
                        <td className="px-1.5 py-px text-right tabular-nums">
                          {row.totalPackages ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-px">
                          <Link
                            href={`/customer/shipments/${encodeURIComponent(row.id)}`}
                            className="text-[#1677ff] hover:text-[#4096ff]"
                          >
                            查看
                          </Link>
                          <span className="mx-1 text-[#d9d9d9]">|</span>
                          <Link
                            href={`/customer/pre-order/new?billId=${encodeURIComponent(row.id)}`}
                            className="text-[#1677ff] hover:text-[#4096ff]"
                          >
                            编辑
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f0f0] px-3 py-2 text-[11px] text-[rgba(0,0,0,0.45)]">
              <span>
                共 {total} 条 · 第 {page} / {totalPages} 页
              </span>
              {totalPages > 1 ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    className="rounded border border-[#d9d9d9] bg-white px-2 py-0.5 disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                    className="rounded border border-[#d9d9d9] bg-white px-2 py-0.5 disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * 列表外层：Suspense 包裹 useSearchParams。
 */
export default function CustomerPreOrderListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f0f2f5] px-4 py-12 text-center text-sm text-slate-500">
          加载中…
        </div>
      }
    >
      <CustomerPreOrderListInner />
    </Suspense>
  );
}
