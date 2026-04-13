"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ManifestStatus = "LOADING" | "SEALED" | "IN_TRANSIT" | "ARRIVED";
type Warehouse = "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";

type ManifestRow = {
  id: string;
  manifestNo: string;
  warehouse: Warehouse;
  status: ManifestStatus;
  carrierInfo: string | null;
  sealedAt: string | null;
  totalBills: number;
  totalPackages: number;
  totalVolume: number;
};

type DetailBill = {
  id: string;
  trackingNumber: string;
  clientUser?: { username: string } | null;
  shippingMark: string | null;
  totalPackages: number | null;
  actualCBM: number;
  shipmentStatus: string;
};

type ManifestDetail = {
  id: string;
  manifestNo: string;
  warehouse: Warehouse;
  status: ManifestStatus;
  carrierInfo: string | null;
  sealedAt: string | null;
  bills: DetailBill[];
};

const STATUS_LABEL: Record<ManifestStatus, string> = {
  LOADING: "装柜中",
  SEALED: "已封柜",
  IN_TRANSIT: "运输中",
  ARRIVED: "已到达",
};

const WAREHOUSE_LABEL: Record<Warehouse, string> = {
  YIWU: "义乌仓",
  GUANGZHOU: "广州仓",
  SHENZHEN: "深圳仓",
  DONGGUAN: "东莞仓",
};

/**
 * 装柜管理：新建柜号、关联 XT 运单、封柜与导出报关清单。
 */
export default function StaffContainerLoadingPage(): React.ReactNode {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ManifestStatus | "ALL">("ALL");
  const [warehouse, setWarehouse] = useState<Warehouse>("YIWU");
  const [carrierInfo, setCarrierInfo] = useState("");
  const [list, setList] = useState<ManifestRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<ManifestDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /**
   * 加载装柜任务列表（支持柜号关键字与状态筛选）。
   */
  const loadList = useCallback(async (): Promise<void> => {
    setLoadingList(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const url = params.toString()
        ? `/api/loading-manifests?${params.toString()}`
        : "/api/loading-manifests";
      const response = await fetch(url, { credentials: "include" });
      const data = (await response.json()) as { list?: ManifestRow[]; message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "装柜任务加载失败");
      }
      const rows = data.list ?? [];
      setList(rows);
      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0].id);
      }
    } catch (e) {
      setList([]);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoadingList(false);
    }
  }, [query, selectedId, statusFilter]);

  /**
   * 加载单个柜号详情（含运单明细）。
   */
  const loadDetail = useCallback(async (id: string): Promise<void> => {
    setLoadingDetail(true);
    setError("");
    try {
      const response = await fetch(`/api/loading-manifests/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const data = (await response.json()) as { manifest?: ManifestDetail; message?: string };
      if (!response.ok || !data.manifest) {
        throw new Error(data.message ?? "详情加载失败");
      }
      setDetail(data.manifest);
    } catch (e) {
      setDetail(null);
      setError(e instanceof Error ? e.message : "详情加载失败");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [loadDetail, selectedId]);

  /**
   * 创建新装柜任务并自动选中。
   */
  async function createManifest(): Promise<void> {
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/loading-manifests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse,
          carrierInfo: carrierInfo.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        manifest?: { id: string; manifestNo: string };
      };
      if (!response.ok || !data.manifest) {
        throw new Error(data.message ?? "创建失败");
      }
      setMessage(`已创建装柜单：${data.manifest.manifestNo}`);
      setCarrierInfo("");
      await loadList();
      setSelectedId(data.manifest.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  }

  /**
   * 输入 XT 单号后加入当前柜号。
   */
  async function addBillToManifest(): Promise<void> {
    if (!selectedId || !trackingInput.trim()) {
      return;
    }
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/loading-manifests/${encodeURIComponent(selectedId)}/add-bill`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingNumber: trackingInput.trim() }),
        }
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "关联失败");
      }
      setMessage(data.message ?? "已关联运单");
      setTrackingInput("");
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "关联失败");
    }
  }

  /**
   * 一键封柜并写入封柜时间。
   */
  async function sealManifest(): Promise<void> {
    if (!selectedId) {
      return;
    }
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/loading-manifests/${encodeURIComponent(selectedId)}/seal`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "封柜失败");
      }
      setMessage(data.message ?? "已封柜");
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "封柜失败");
    }
  }

  /**
   * 推进柜状态：已封柜 -> 运输中 -> 已到达。
   */
  async function advanceManifestStatus(target: ManifestStatus): Promise<void> {
    if (!selectedId) {
      return;
    }
    setUpdatingStatus(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/loading-manifests/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: target }),
        }
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "状态更新失败");
      }
      setMessage(data.message ?? "状态已更新");
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "状态更新失败");
    } finally {
      setUpdatingStatus(false);
    }
  }

  /**
   * 导出报关汇总清单。
   */
  function exportManifest(): void {
    if (!selectedId) {
      return;
    }
    window.open(
      `/api/loading-manifests/${encodeURIComponent(selectedId)}/export`,
      "_blank"
    );
  }

  /**
   * 打印柜号交接单。
   */
  function printHandover(): void {
    if (!detail) return;
    const html = `
      <html><head><title>装柜交接单</title>
      <style>
      body{font-family:Arial,"Microsoft YaHei",sans-serif;padding:16px;color:#111}
      h1{font-size:20px;margin:0 0 12px}
      .meta{margin-bottom:12px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px;text-align:left}
      th{background:#f6f6f6}
      </style></head><body>
      <h1>湘泰物流 装柜交接单</h1>
      <div class="meta">
      柜号：${detail.manifestNo} ｜ 仓库：${WAREHOUSE_LABEL[detail.warehouse]} ｜ 状态：${STATUS_LABEL[detail.status]}<br/>
      总票数：${summary.totalBills} ｜ 总件数：${summary.totalPackages} ｜ 总体积：${summary.totalVolume.toFixed(4)} CBM
      </div>
      <table>
      <thead><tr><th>运单号</th><th>客户</th><th>唛头</th><th>件数</th><th>体积(CBM)</th></tr></thead>
      <tbody>
      ${detail.bills
        .map(
          (b) =>
            `<tr><td>${b.trackingNumber}</td><td>${b.clientUser?.username ?? "—"}</td><td>${b.shippingMark ?? "—"}</td><td>${b.totalPackages ?? 0}</td><td>${b.actualCBM.toFixed(4)}</td></tr>`
        )
        .join("")}
      </tbody></table></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const summary = useMemo(() => {
    if (!detail) return { totalBills: 0, totalPackages: 0, totalVolume: 0 };
    return {
      totalBills: detail.bills.length,
      totalPackages: detail.bills.reduce((s, b) => s + (b.totalPackages ?? 0), 0),
      totalVolume: detail.bills.reduce((s, b) => s + (b.actualCBM ?? 0), 0),
    };
  }, [detail]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-brand">装柜管理</h1>
      <p className="mt-2 text-sm text-slate-600">
        支持新建柜号、扫描 XT 运单入柜、封柜留痕与报关清单导出。
      </p>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-5">
          <select
            value={warehouse}
            onChange={(e) => {
              setWarehouse(e.target.value as Warehouse);
            }}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            {Object.entries(WAREHOUSE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={carrierInfo}
            onChange={(e) => {
              setCarrierInfo(e.target.value);
            }}
            placeholder="车牌号或柜号备注"
            className="rounded border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
          />
          <button
            type="button"
            onClick={() => {
              void createManifest();
            }}
            className="rounded border border-brand/30 px-3 py-2 text-sm font-medium text-brand"
          >
            + 新增装柜单
          </button>
          <div className="flex gap-2 sm:col-span-5">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="柜号搜索（如 CN-TH-20260413001）"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ManifestStatus | "ALL");
              }}
              className="rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="ALL">全部状态</option>
              <option value="LOADING">装柜中</option>
              <option value="SEALED">已封柜</option>
              <option value="IN_TRANSIT">运输中</option>
              <option value="ARRIVED">已到达</option>
            </select>
            <button
              type="button"
              onClick={() => {
                void loadList();
              }}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              查询
            </button>
          </div>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
            装柜任务列表
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">柜号</th>
                  <th className="px-3 py-2 text-left font-medium">仓库</th>
                  <th className="px-3 py-2 text-left font-medium">总票数</th>
                  <th className="px-3 py-2 text-left font-medium">总件数</th>
                  <th className="px-3 py-2 text-left font-medium">总体积</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelectedId(row.id);
                    }}
                    className={`cursor-pointer border-t border-slate-100 ${
                      row.id === selectedId ? "bg-indigo-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-brand">{row.manifestNo}</td>
                    <td className="px-3 py-2">{WAREHOUSE_LABEL[row.warehouse]}</td>
                    <td className="px-3 py-2">{row.totalBills}</td>
                    <td className="px-3 py-2">{row.totalPackages}</td>
                    <td className="px-3 py-2">{row.totalVolume.toFixed(4)} CBM</td>
                    <td className="px-3 py-2">{STATUS_LABEL[row.status]}</td>
                  </tr>
                ))}
                {list.length === 0 && !loadingList ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                      暂无装柜任务
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-medium text-slate-700">待装柜清单</p>
            {detail ? (
              <p className="mt-1 text-xs text-slate-500">
                柜号：<span className="font-mono text-slate-700">{detail.manifestNo}</span>
                {" · "}
                状态：{STATUS_LABEL[detail.status]}
              </p>
            ) : null}
          </div>
          <div className="space-y-3 p-4">
            <div className="flex gap-2">
              <input
                value={trackingInput}
                onChange={(e) => {
                  setTrackingInput(e.target.value);
                }}
                placeholder="输入或扫码 XT 运单号"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!detail || detail.status !== "LOADING"}
                onClick={() => {
                  void addBillToManifest();
                }}
                className="rounded border border-brand/30 px-3 py-2 text-sm font-medium text-brand disabled:opacity-50"
              >
                关联运单
              </button>
            </div>

            {detail ? (
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                总票数：{summary.totalBills} · 总件数：{summary.totalPackages} · 总体积：
                {summary.totalVolume.toFixed(4)} CBM
                {detail.sealedAt ? (
                  <>
                    {" · "}封柜时间：
                    {new Date(detail.sealedAt).toLocaleString("zh-CN", {
                      hour12: false,
                    })}
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-400">请选择左侧装柜任务。</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!detail || detail.status !== "LOADING"}
                onClick={() => {
                  void sealManifest();
                }}
                className="rounded border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 disabled:opacity-50"
              >
                一键封柜
              </button>
              <button
                type="button"
                disabled={!detail}
                onClick={exportManifest}
                className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                导出清单
              </button>
              <button
                type="button"
                disabled={!detail}
                onClick={printHandover}
                className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                打印交接单
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!detail || detail.status !== "SEALED" || updatingStatus}
                onClick={() => {
                  void advanceManifestStatus("IN_TRANSIT");
                }}
                className="rounded border border-sky-300 px-3 py-2 text-sm text-sky-700 disabled:opacity-50"
              >
                标记运输中
              </button>
              <button
                type="button"
                disabled={!detail || detail.status !== "IN_TRANSIT" || updatingStatus}
                onClick={() => {
                  void advanceManifestStatus("ARRIVED");
                }}
                className="rounded border border-emerald-300 px-3 py-2 text-sm text-emerald-700 disabled:opacity-50"
              >
                标记已到达
              </button>
            </div>

            <div className="max-h-[360px] overflow-auto rounded border border-slate-200">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">运单号</th>
                    <th className="px-2 py-1.5 text-left font-medium">客户</th>
                    <th className="px-2 py-1.5 text-left font-medium">唛头</th>
                    <th className="px-2 py-1.5 text-left font-medium">件数</th>
                    <th className="px-2 py-1.5 text-left font-medium">体积</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.bills ?? []).map((b) => (
                    <tr key={b.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-mono text-brand">{b.trackingNumber}</td>
                      <td className="px-2 py-1.5">{b.clientUser?.username ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono">{b.shippingMark ?? "—"}</td>
                      <td className="px-2 py-1.5">{b.totalPackages ?? 0}</td>
                      <td className="px-2 py-1.5">{b.actualCBM.toFixed(4)}</td>
                    </tr>
                  ))}
                  {detail && detail.bills.length === 0 && !loadingDetail ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-slate-400">
                        当前柜号尚未关联运单
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
