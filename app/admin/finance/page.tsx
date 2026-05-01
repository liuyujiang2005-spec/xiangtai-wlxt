"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleDollarSign } from "lucide-react";
import { CurrencyAmount } from "@/app/components/CurrencyAmount";

type Summary = {
  totalBills: number;
  monthProjectedRevenue: number;
  totalWaivedAmount: number;
  totalActualReceivable: number;
  rows: Array<{
    id: string;
    trackingNumber: string;
    warehouse: "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
    clientName: string;
    shippingMark: string;
    actualCBM: number;
    billingCBM: number;
    actualFee: number;
    minCompensationFee: number;
    finalCharge: number;
    isWaived: boolean;
    waivedAmount: number;
    createdAt: string;
  }>;
};

/**
 * 财务结算与利润：展示运单规模与应收汇总（管理员专用）。
 */
export default function AdminFinancePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string>("");
  const [waivingId, setWaivingId] = useState<string>("");
  const [clientKeyword, setClientKeyword] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [waiveFilter, setWaiveFilter] = useState<"ALL" | "WAIVED" | "UNWAIVED">(
    "ALL"
  );
  const [warehouseFilter, setWarehouseFilter] = useState<
    "ALL" | "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN"
  >("ALL");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [pageSize, setPageSize] = useState<number>(15);
  const [sortByAmount, setSortByAmount] = useState<"NONE" | "ASC" | "DESC">(
    "NONE"
  );
  const [queryReady, setQueryReady] = useState<boolean>(false);
  const hydratedFromQueryRef = useRef<boolean>(false);
  const skipResetOnceRef = useRef<boolean>(true);

  const WAREHOUSE_LABEL: Record<
    "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN",
    string
  > = {
    YIWU: "义乌仓",
    GUANGZHOU: "广州仓",
    SHENZHEN: "深圳仓",
    DONGGUAN: "东莞仓",
  };

  /**
   * 首次进入页面时从 URL 恢复筛选与分页参数。
   */
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const q = search.get("q") ?? "";
    const month = search.get("month") ?? "";
    const waived = search.get("waived") ?? "ALL";
    const warehouse = search.get("warehouse") ?? "ALL";
    const min = search.get("min") ?? "";
    const max = search.get("max") ?? "";
    const sort = search.get("sort") ?? "NONE";
    const size = search.get("size") ?? "15";
    const pageValue = search.get("page") ?? "1";
    skipResetOnceRef.current = true;
    setClientKeyword(q);
    setMonthFilter(month);
    if (waived === "ALL" || waived === "WAIVED" || waived === "UNWAIVED") {
      setWaiveFilter(waived);
    }
    if (
      warehouse === "ALL" ||
      warehouse === "YIWU" ||
      warehouse === "GUANGZHOU" ||
      warehouse === "SHENZHEN" ||
      warehouse === "DONGGUAN"
    ) {
      setWarehouseFilter(warehouse);
    }
    setMinAmount(min);
    setMaxAmount(max);
    if (sort === "NONE" || sort === "ASC" || sort === "DESC") {
      setSortByAmount(sort);
    }
    const parsedSize = Number.parseInt(size, 10);
    if ([15, 30, 50].includes(parsedSize)) {
      setPageSize(parsedSize);
    }
    const parsedPage = Number.parseInt(pageValue, 10);
    if (!Number.isNaN(parsedPage) && parsedPage > 0) {
      setPage(parsedPage);
      setPageInput(String(parsedPage));
    }
    hydratedFromQueryRef.current = true;
    setQueryReady(true);
  }, []);

  /**
   * 拉取财务汇总接口数据。
   */
  const load = useCallback(async (): Promise<void> => {
    setError("");
    try {
      const response = await fetch("/api/admin/finance-summary", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("加载失败");
      }
      const json = (await response.json()) as Summary;
      setData(json);
    } catch {
      setError("无法加载财务数据，请确认已使用管理员账号登录。");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 管理员豁免低消后刷新财务行与合计。
   */
  const handleWaive = useCallback(async (id: string): Promise<void> => {
    setWaivingId(id);
    setError("");
    try {
      const response = await fetch(`/api/transport-bills/${id}/waive`, {
        method: "PATCH",
        credentials: "include",
      });
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? "豁免失败");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "豁免失败");
    } finally {
      setWaivingId("");
    }
  }, [load]);

  /**
   * 根据筛选条件过滤财务明细行。
   */
  const filteredRows = useMemo(() => {
    if (!data) {
      return [];
    }
    const nextRows = data.rows.filter((row) => {
      const keyword = clientKeyword.trim().toLowerCase();
      const byClient =
        keyword.length === 0 ||
        row.clientName.toLowerCase().includes(keyword) ||
        row.shippingMark.toLowerCase().includes(keyword) ||
        row.trackingNumber.toLowerCase().includes(keyword);
      const byWaived =
        waiveFilter === "ALL" ||
        (waiveFilter === "WAIVED" ? row.isWaived : !row.isWaived);
      const byMonth =
        monthFilter.length === 0 || row.createdAt.slice(0, 7) === monthFilter;
      const byWarehouse =
        warehouseFilter === "ALL" || row.warehouse === warehouseFilter;
      const min = minAmount.trim() ? Number.parseFloat(minAmount) : null;
      const max = maxAmount.trim() ? Number.parseFloat(maxAmount) : null;
      const byAmount =
        (min === null || Number.isNaN(min) || row.finalCharge >= min) &&
        (max === null || Number.isNaN(max) || row.finalCharge <= max);
      return byClient && byWaived && byMonth && byWarehouse && byAmount;
    });
    if (sortByAmount === "ASC") {
      return [...nextRows].sort((a, b) => a.finalCharge - b.finalCharge);
    }
    if (sortByAmount === "DESC") {
      return [...nextRows].sort((a, b) => b.finalCharge - a.finalCharge);
    }
    return nextRows;
  }, [
    clientKeyword,
    data,
    monthFilter,
    waiveFilter,
    warehouseFilter,
    minAmount,
    maxAmount,
    sortByAmount,
  ]);

  /**
   * 当筛选条件变化时，分页回到第一页。
   */
  useEffect(() => {
    if (!hydratedFromQueryRef.current) {
      return;
    }
    if (skipResetOnceRef.current) {
      skipResetOnceRef.current = false;
      return;
    }
    setPage(1);
    setPageInput("1");
  }, [
    clientKeyword,
    monthFilter,
    waiveFilter,
    warehouseFilter,
    minAmount,
    maxAmount,
    sortByAmount,
    pageSize,
  ]);

  /**
   * 计算筛选结果下的顶部财务看板数据。
   */
  const cardMetrics = useMemo(() => {
    let projectedRevenue = 0;
    let waivedAmount = 0;
    let actualReceivable = 0;
    for (const row of filteredRows) {
      projectedRevenue += row.finalCharge + row.waivedAmount;
      waivedAmount += row.waivedAmount;
      actualReceivable += row.finalCharge;
    }
    return {
      projectedRevenue,
      waivedAmount,
      actualReceivable,
    };
  }, [filteredRows]);

  /**
   * 基于筛选结果计算分页数据。
   */
  const pagination = useMemo(() => {
    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return {
      total,
      totalPages,
      safePage,
      pageRows: filteredRows.slice(start, start + pageSize),
    };
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPageInput(String(pagination.safePage));
  }, [pagination.safePage]);

  /**
   * 将当前筛选与分页写入 URL，便于刷新恢复和分享链接。
   */
  useEffect(() => {
    if (!queryReady) {
      return;
    }
    const params = new URLSearchParams();
    if (clientKeyword.trim()) params.set("q", clientKeyword.trim());
    if (monthFilter) params.set("month", monthFilter);
    if (waiveFilter !== "ALL") params.set("waived", waiveFilter);
    if (warehouseFilter !== "ALL") params.set("warehouse", warehouseFilter);
    if (minAmount.trim()) params.set("min", minAmount.trim());
    if (maxAmount.trim()) params.set("max", maxAmount.trim());
    if (sortByAmount !== "NONE") params.set("sort", sortByAmount);
    if (pageSize !== 15) params.set("size", String(pageSize));
    if (pagination.safePage > 1) params.set("page", String(pagination.safePage));
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [
    queryReady,
    clientKeyword,
    monthFilter,
    waiveFilter,
    warehouseFilter,
    minAmount,
    maxAmount,
    sortByAmount,
    pageSize,
    pagination.safePage,
    pathname,
    router,
  ]);

  /**
   * 导出当前筛选结果为 CSV。
   */
  const handleExportCsv = useCallback((): void => {
    if (!data) {
      return;
    }
    const header = [
      "单号",
      "所属客户",
      "唛头",
      "实际体积(CBM)",
      "计费体积(CBM)",
      "计算运费(¥)",
      "补差金额(¥)",
      "最终应收(¥)",
      "是否已豁免",
      "创建时间",
    ];
    const lines = filteredRows.map((row) =>
      [
        row.trackingNumber,
        row.clientName,
        row.shippingMark,
        row.actualCBM.toFixed(4),
        row.billingCBM.toFixed(4),
        row.actualFee.toFixed(2),
        row.minCompensationFee.toFixed(2),
        row.finalCharge.toFixed(2),
        row.isWaived ? "是" : "否",
        new Date(row.createdAt).toLocaleString("zh-CN"),
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
    a.download = `finance-${monthFilter || "all"}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [data, filteredRows, monthFilter]);

  /**
   * 跳转到指定页码（带边界保护）。
   */
  function handleJumpPage(): void {
    const target = Number.parseInt(pageInput, 10);
    if (Number.isNaN(target)) {
      setPageInput(String(pagination.safePage));
      return;
    }
    const clamped = Math.min(Math.max(1, target), pagination.totalPages);
    setPage(clamped);
    setPageInput(String(clamped));
  }

  /**
   * 清空筛选器并恢复默认排序分页。
   */
  function handleResetFilters(): void {
    setClientKeyword("");
    setMonthFilter("");
    setWaiveFilter("ALL");
    setWarehouseFilter("ALL");
    setMinAmount("");
    setMaxAmount("");
    setSortByAmount("NONE");
    setPageSize(15);
    setPage(1);
    setPageInput("1");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <CircleDollarSign className="h-7 w-7 text-brand" />
        <h1 className="text-xl font-semibold text-brand">财务结算与利润</h1>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">本月预计总营收（含低消补差）</p>
            <p className="mt-1 text-brand">
              <CurrencyAmount
                value={cardMetrics.projectedRevenue}
                className="text-2xl text-brand"
              />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">已豁免金额汇总</p>
            <p className="mt-1 text-brand">
              <CurrencyAmount
                value={cardMetrics.waivedAmount}
                className="text-2xl text-brand"
              />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">实际应收总额（¥）</p>
            <p className="mt-1 text-brand">
              <CurrencyAmount
                value={cardMetrics.actualReceivable}
                className="text-2xl text-brand"
              />
            </p>
          </div>
        </div>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-9">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">客户 / 唛头 / 单号</span>
              <input
                value={clientKeyword}
                onChange={(e) => {
                  setClientKeyword(e.target.value);
                }}
                placeholder="输入关键字筛选"
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">月份</span>
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value);
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">豁免状态</span>
              <select
                value={waiveFilter}
                onChange={(e) => {
                  setWaiveFilter(
                    e.target.value as "ALL" | "WAIVED" | "UNWAIVED"
                  );
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              >
                <option value="ALL">全部</option>
                <option value="WAIVED">仅已豁免</option>
                <option value="UNWAIVED">仅未豁免</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">仓库</span>
              <select
                value={warehouseFilter}
                onChange={(e) => {
                  setWarehouseFilter(
                    e.target.value as
                      | "ALL"
                      | "YIWU"
                      | "GUANGZHOU"
                      | "SHENZHEN"
                      | "DONGGUAN"
                  );
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              >
                <option value="ALL">全部仓库</option>
                <option value="YIWU">义乌仓</option>
                <option value="GUANGZHOU">广州仓</option>
                <option value="SHENZHEN">深圳仓</option>
                <option value="DONGGUAN">东莞仓</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">最低应收（¥）</span>
              <input
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                }}
                placeholder="例如 100"
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">最高应收（¥）</span>
              <input
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                }}
                placeholder="例如 5000"
                className="w-full rounded border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">金额排序</span>
              <select
                value={sortByAmount}
                onChange={(e) => {
                  setSortByAmount(e.target.value as "NONE" | "ASC" | "DESC");
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              >
                <option value="NONE">默认</option>
                <option value="ASC">应收从低到高</option>
                <option value="DESC">应收从高到低</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">每页条数</span>
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(next) && next > 0) {
                    setPageSize(next);
                  }
                }}
                className="w-full rounded border border-slate-200 px-3 py-2"
              >
                <option value="15">15 条</option>
                <option value="30">30 条</option>
                <option value="50">50 条</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full rounded border border-brand/30 px-3 py-2 text-sm font-medium text-brand"
              >
                导出 CSV
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                重置筛选
              </button>
            </div>
          </div>
        </section>
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">单号</th>
                  <th className="px-3 py-2 text-left font-medium">仓库</th>
                  <th className="px-3 py-2 text-left font-medium">所属客户</th>
                  <th className="px-3 py-2 text-left font-medium">唛头</th>
                  <th className="px-3 py-2 text-left font-medium">实际体积</th>
                  <th className="px-3 py-2 text-left font-medium">计费体积</th>
                  <th className="px-3 py-2 text-left font-medium">计算运费</th>
                  <th className="px-3 py-2 text-left font-medium">补差金额 (¥)</th>
                  <th className="px-3 py-2 text-left font-medium">总计应收</th>
                  <th className="px-3 py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-brand">{row.trackingNumber}</td>
                    <td className="px-3 py-2">{WAREHOUSE_LABEL[row.warehouse]}</td>
                    <td className="px-3 py-2">{row.clientName}</td>
                    <td className="px-3 py-2 font-mono">{row.shippingMark}</td>
                    <td className="px-3 py-2">{row.actualCBM.toFixed(4)} CBM</td>
                    <td className="px-3 py-2">{row.billingCBM.toFixed(4)} CBM</td>
                    <td className="px-3 py-2"><CurrencyAmount value={row.actualFee} /></td>
                    <td className="px-3 py-2"><CurrencyAmount value={row.minCompensationFee} /></td>
                    <td className="px-3 py-2 font-medium"><CurrencyAmount value={row.finalCharge} /></td>
                    <td className="px-3 py-2">
                      {!row.isWaived ? (
                        <button
                          type="button"
                          disabled={waivingId === row.id}
                          onClick={() => { void handleWaive(row.id); }}
                          className="rounded border border-brand/30 px-2.5 py-1 text-xs font-medium text-brand disabled:opacity-50"
                        >
                          {waivingId === row.id ? "处理中..." : "豁免补差"}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700">已豁免</span>
                      )}
                    </td>
                  </tr>
                ))}
                {pagination.pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-400">暂无 XT 正式单</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-sm text-slate-600">
            <span>
              共 {pagination.total} 条，当前第 {pagination.safePage} / {pagination.totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.safePage <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                }}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={pagination.safePage >= pagination.totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                }}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                下一页
              </button>
              <input
                value={pageInput}
                onChange={(e) => {
                  setPageInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleJumpPage();
                  }
                }}
                className="w-16 rounded border border-slate-200 px-2 py-1"
              />
              <button
                type="button"
                onClick={handleJumpPage}
                className="rounded border border-slate-200 px-2 py-1"
              >
                跳转
              </button>
            </div>
          </div>
        </section>
        </>
      ) : !error ? (
        <p className="text-sm text-slate-500">加载中…</p>
      ) : null}
    </main>
  );
}
