"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search, ShieldCheck, PackageCheck } from "lucide-react";
import { CurrencyAmount } from "@/app/components/CurrencyAmount";
import { calculateCharge } from "@/lib/core/charge-formulas";

type BillRow = {
  id: string;
  trackingNumber: string;
  warehouse: "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
  shippingMethod: "SEA" | "LAND";
  actualCBM: number;
  actualWeight: number;
  unitPrice: number;
  isMinChargeWaived: boolean;
  isForecastPending: boolean;
  domesticTracking: string | null;
  goodsName: string | null;
  estimatedPieces: number | null;
  /** 唛头（客户预报存登录名） */
  shippingMark: string | null;
  /** 关联客户登录名（无唛头时可回退展示） */
  clientLogin: string | null;
  charge: {
    actualFee: number;
    minChargeDifferenceFee: number;
    finalCharge: number;
  };
  hasMinCompensation: boolean;
};

type InboundProductRow = {
  key: string;
  productName: string;
  boxCount: string;
  cargoType: "GENERAL" | "SENSITIVE" | "INSPECTION";
  unitsPerBox: string;
  domesticTracking: string;
  inboundTracking: string;
  sku: string;
  boxNumber: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  unitWeightKg: string;
  startBoxNo: string;
  endBoxNo: string;
  remark: string;
};

const WAREHOUSE_LABEL: Record<BillRow["warehouse"], string> = {
  YIWU: "义乌仓",
  GUANGZHOU: "广州仓",
  SHENZHEN: "深圳仓",
  DONGGUAN: "东莞仓",
};

const SHIPPING_LABEL: Record<BillRow["shippingMethod"], string> = {
  SEA: "海运",
  LAND: "陆运",
};

/**
 * 列表唛头展示：优先存库唛头，否则客户登录名。
 */
function displayShippingMark(row: BillRow): string {
  return row.shippingMark ?? row.clientLogin ?? "—";
}

/**
 * 创建入库产品空行。
 */
function createEmptyInboundRow(): InboundProductRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    productName: "",
    boxCount: "1",
    cargoType: "GENERAL",
    unitsPerBox: "1",
    domesticTracking: "",
    inboundTracking: "",
    sku: "",
    boxNumber: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    unitWeightKg: "",
    startBoxNo: "",
    endBoxNo: "",
    remark: "",
  };
}

/**
 * 运单管理列表：管理员与员工可见；预报筛选、确认入库与豁免逻辑按角色区分。
 */
export default function TransportBillsPage() {
  const [query, setQuery] = useState<string>("");
  const [forecastOnly, setForecastOnly] = useState<boolean>(false);
  const [rows, setRows] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<BillRow | null>(null);
  const [ciMethod, setCiMethod] = useState<BillRow["shippingMethod"]>("SEA");
  const [ciProducts, setCiProducts] = useState<InboundProductRow[]>([
    createEmptyInboundRow(),
  ]);
  const [ciPrice, setCiPrice] = useState<string>("");
  const [ciWaive, setCiWaive] = useState<boolean>(false);

  const isAdmin = userRole === "ADMIN";
  const showWarehouseOps =
    userRole === "ADMIN" || userRole === "STAFF";

  /**
   * 读取当前用户角色，用于控制操作列显隐。
   */
  const loadRole = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) {
        setUserRole(null);
        return;
      }
      const data = (await response.json()) as {
        user: { role: string } | null;
      };
      setUserRole(data.user?.role ?? null);
    } catch {
      setUserRole(null);
    }
  }, []);

  /**
   * 基于搜索词与预报筛选拉取运单列表。
   */
  async function fetchBills(searchTerm: string, onlyForecast: boolean): Promise<void> {
    setLoading(true);
    setErrorMessage("");
    try {
      const qs = new URLSearchParams();
      if (searchTerm) {
        qs.set("query", searchTerm);
      }
      if (onlyForecast) {
        qs.set("forecastOnly", "1");
      }
      const response = await fetch(`/api/transport-bills?${qs.toString()}`, {
        credentials: "include",
      });
      const data = (await response.json()) as { list?: BillRow[] };

      if (response.status === 401) {
        setRows([]);
        setErrorMessage("未登录或会话已过期，请重新登录（需管理员或员工账号）。");
        return;
      }
      if (response.status === 403) {
        setRows([]);
        setErrorMessage("当前账号无权查看运单，请使用管理员或员工账号。");
        return;
      }
      if (!response.ok || !data.list) {
        throw new Error("运单列表加载失败");
      }

      setRows(data.list);
    } catch {
      setErrorMessage("运单列表加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRole();
  }, [loadRole]);

  /**
   * 首次进入页面时读取 URL 参数，支持从员工菜单直接进入“仅预报”视图。
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setForecastOnly(params.get("forecastOnly") === "1");
  }, []);

  useEffect(() => {
    void fetchBills(query.trim(), forecastOnly);
  }, [forecastOnly]);

  /**
   * 触发搜索并刷新列表。
   */
  async function handleSearchSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    await fetchBills(query.trim(), forecastOnly);
  }

  /**
   * 管理员对单行执行低消豁免，并即时更新该行状态与金额。
   */
  async function handleWaive(id: string): Promise<void> {
    setWaivingId(id);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/transport-bills/${id}/waive`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = (await response.json()) as {
        bill?: Partial<BillRow>;
        charge?: BillRow["charge"];
        hasMinCompensation?: boolean;
        message?: string;
      };

      if (!response.ok || !data.bill || !data.charge) {
        throw new Error(data.message ?? "豁免失败");
      }

      setRows((previous) =>
        previous.map((row) =>
          row.id === id
            ? {
                ...row,
                isMinChargeWaived: true,
                charge: data.charge as BillRow["charge"],
                hasMinCompensation: false,
              }
            : row
        )
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "豁免失败");
    } finally {
      setWaivingId(null);
    }
  }

  /**
   * 打开确认入库弹窗并初始化表单。
   */
  function openConfirmModal(row: BillRow): void {
    setConfirmRow(row);
    setCiMethod(row.shippingMethod);
    setCiProducts([createEmptyInboundRow()]);
    setCiPrice("");
    setCiWaive(false);
  }

  /**
   * 关闭确认入库弹窗。
   */
  function closeConfirmModal(): void {
    setConfirmRow(null);
  }

  /**
   * 更新某一行产品明细字段。
   */
  function updateCiProduct(
    key: string,
    patch: Partial<InboundProductRow>
  ): void {
    setCiProducts((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  /**
   * 新增产品行，支持一票多 SKU。
   */
  function addCiProductRow(): void {
    setCiProducts((prev) => [...prev, createEmptyInboundRow()]);
  }

  /**
   * 删除产品行（至少保留一行）。
   */
  function removeCiProductRow(key: string): void {
    setCiProducts((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((row) => row.key !== key);
    });
  }

  /**
   * 汇总明细行得到总重量、总体积与总箱数，用于自动计费与提交。
   */
  const ciSummary = useMemo(() => {
    let totalWeight = 0;
    let totalVolume = 0;
    let totalBoxes = 0;
    for (const row of ciProducts) {
      const boxes = Number.parseInt(row.boxCount, 10);
      const l = Number.parseFloat(row.lengthCm);
      const w = Number.parseFloat(row.widthCm);
      const h = Number.parseFloat(row.heightCm);
      const uw = Number.parseFloat(row.unitWeightKg);
      const safeBoxes = Number.isNaN(boxes) || boxes < 0 ? 0 : boxes;
      const unitVolume =
        !Number.isNaN(l) &&
        !Number.isNaN(w) &&
        !Number.isNaN(h) &&
        l > 0 &&
        w > 0 &&
        h > 0
          ? (l * w * h) / 1_000_000
          : 0;
      const unitWeight = !Number.isNaN(uw) && uw > 0 ? uw : 0;
      totalBoxes += safeBoxes;
      totalWeight += unitWeight * safeBoxes;
      totalVolume += unitVolume * safeBoxes;
    }
    return { totalWeight, totalVolume, totalBoxes };
  }, [ciProducts]);

  const previewCharge = useMemo(() => {
    if (!confirmRow) {
      return null;
    }
    const price = Number.parseFloat(ciPrice);
    if (
      Number.isNaN(price) ||
      ciSummary.totalVolume < 0 ||
      price < 0
    ) {
      return null;
    }
    return calculateCharge({
      shippingMethod: ciMethod,
      actualCBM: ciSummary.totalVolume,
      unitPrice: price,
      isMinChargeWaived: ciWaive,
    });
  }, [confirmRow, ciMethod, ciPrice, ciSummary.totalVolume, ciWaive]);

  /**
   * 提交确认入库：写入实测数据并触发计费。
   */
  async function handleConfirmInbound(): Promise<void> {
    if (!confirmRow) {
      return;
    }
    const unitPrice = Number.parseFloat(ciPrice);
    const hasBadRow = ciProducts.some((row) => {
      const name = row.productName.trim();
      const boxes = Number.parseInt(row.boxCount, 10);
      const units = Number.parseInt(row.unitsPerBox, 10);
      return !name || Number.isNaN(boxes) || boxes < 1 || Number.isNaN(units) || units < 1;
    });
    if (
      Number.isNaN(unitPrice) ||
      unitPrice < 0 ||
      hasBadRow
    ) {
      setErrorMessage("请填写有效的产品明细与单价。");
      return;
    }

    setConfirmingId(confirmRow.id);
    setErrorMessage("");
    try {
      const response = await fetch(
        `/api/transport-bills/${confirmRow.id}/confirm-inbound`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shippingMethod: ciMethod,
            unitPrice,
            isMinChargeWaived: ciWaive,
            products: ciProducts.map((row) => ({
              productName: row.productName.trim(),
              boxCount: Number.parseInt(row.boxCount, 10),
              cargoType: row.cargoType,
              unitsPerBox: Number.parseInt(row.unitsPerBox, 10),
              domesticTracking: row.domesticTracking.trim() || undefined,
              inboundTracking: row.inboundTracking.trim() || undefined,
              sku: row.sku.trim() || undefined,
              boxNumber: row.boxNumber.trim() || undefined,
              lengthCm: row.lengthCm.trim() ? Number.parseFloat(row.lengthCm) : undefined,
              widthCm: row.widthCm.trim() ? Number.parseFloat(row.widthCm) : undefined,
              heightCm: row.heightCm.trim() ? Number.parseFloat(row.heightCm) : undefined,
              unitWeightKg: row.unitWeightKg.trim()
                ? Number.parseFloat(row.unitWeightKg)
                : undefined,
              startBoxNo: row.startBoxNo.trim()
                ? Number.parseInt(row.startBoxNo, 10)
                : undefined,
              endBoxNo: row.endBoxNo.trim()
                ? Number.parseInt(row.endBoxNo, 10)
                : undefined,
              remark: row.remark.trim() || undefined,
            })),
          }),
        }
      );
      const data = (await response.json()) as {
        bill?: BillRow;
        charge?: BillRow["charge"];
        hasMinCompensation?: boolean;
        message?: string;
      };
      if (!response.ok || !data.bill || !data.charge) {
        throw new Error(data.message ?? "确认入库失败");
      }
      const updated: BillRow = {
        ...confirmRow,
        ...data.bill,
        charge: data.charge,
        hasMinCompensation: Boolean(data.hasMinCompensation),
      };
      setRows((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      closeConfirmModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "确认入库失败");
    } finally {
      setConfirmingId(null);
    }
  }

  const totalText = useMemo(() => `共 ${rows.length} 条运单`, [rows.length]);

  const emptyColSpan = showWarehouseOps ? 8 : 7;

  /**
   * 导出当前列表为 CSV（仅管理员）。
   */
  function handleExportCsv(): void {
    if (!isAdmin) {
      return;
    }
    const headers = [
      "单号",
      "唛头",
      "类型",
      "仓库",
      "运输方式",
      "实际体积(CBM)",
      "实际重量(KG)",
      "实际费",
      "低消补差费",
      "最终待支付金额",
      "低消状态",
    ];

    const lines = rows.map((row) => {
      const status = row.isMinChargeWaived
        ? "已豁免"
        : row.hasMinCompensation
          ? "含低消补偿"
          : "正常";

      return [
        row.trackingNumber,
        displayShippingMark(row),
        row.isForecastPending ? "预报待入库" : "正式",
        WAREHOUSE_LABEL[row.warehouse],
        SHIPPING_LABEL[row.shippingMethod],
        row.actualCBM.toFixed(3),
        row.actualWeight.toFixed(2),
        row.charge.actualFee.toFixed(2),
        row.charge.minChargeDifferenceFee.toFixed(2),
        row.charge.finalCharge.toFixed(2),
        status,
      ];
    });

    const csv = [headers, ...lines]
      .map((line) =>
        line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transport-bills-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 text-slate-900 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-brand">运单管理列表</h1>
        <p className="mt-1 text-sm text-slate-500">
          湘泰物流 · 体积/重量/方式与费用（低消按海运 0.5 / 陆运 0.3 CBM）
        </p>
        <p className="mt-2">
          <Link
            href="/transport-bills/new"
            className="text-sm font-medium text-brand underline-offset-2 hover:underline"
          >
            新运单录入
          </Link>
        </p>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3"
        >
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入运单号快速查询"
            className="w-full border-0 bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white"
          >
            搜索
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">筛选</span>
          <button
            type="button"
            onClick={() => {
              setForecastOnly(false);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              !forecastOnly
                ? "bg-brand text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => {
              setForecastOnly(true);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              forecastOnly
                ? "bg-slate-600 text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            仅显示预报单
          </button>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand/30 px-3 py-2 text-sm font-medium text-brand"
          >
            <Download className="h-4 w-4" />
            数据导出
          </button>
        ) : null}
      </div>

      <p className="mb-3 text-sm text-slate-500">
        {loading ? "加载中..." : totalText}
      </p>

      {errorMessage ? (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      <section className="md:hidden">
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className={`rounded-2xl border border-slate-200 p-3 ${
                row.isForecastPending
                  ? "bg-slate-100 text-slate-600"
                  : "bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={`text-sm font-semibold ${
                    row.isForecastPending ? "text-slate-700" : "text-brand"
                  }`}
                >
                  {row.trackingNumber}
                </p>
                {row.isForecastPending ? (
                  <span className="rounded-full bg-slate-300/80 px-2 py-0.5 text-xs font-medium text-slate-800">
                    预报
                  </span>
                ) : null}
              </div>
              {row.isForecastPending &&
              (row.domesticTracking || row.goodsName) ? (
                <p className="mt-1 text-xs text-slate-500">
                  {row.domesticTracking
                    ? `快递：${row.domesticTracking}`
                    : null}
                  {row.domesticTracking && row.goodsName ? " · " : null}
                  {row.goodsName ? `货名：${row.goodsName}` : null}
                  {(row.estimatedPieces ?? 0) > 0
                    ? ` · 预估 ${row.estimatedPieces ?? 0} 件`
                    : null}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-600">
                <span className="text-slate-500">唛头：</span>
                <span className="font-mono font-medium">
                  {displayShippingMark(row)}
                </span>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
                <p className="text-slate-500">仓库</p>
                <p>{WAREHOUSE_LABEL[row.warehouse]}</p>
                <p className="text-slate-500">运输方式</p>
                <p>{SHIPPING_LABEL[row.shippingMethod]}</p>
                <p className="text-slate-500">实际体积</p>
                <p>{row.actualCBM.toFixed(3)} CBM</p>
                <p className="text-slate-500">实际重量</p>
                <p>{row.actualWeight.toFixed(2)} KG</p>
                <p className="text-slate-500">最终费用</p>
                <p className="flex flex-wrap items-center gap-2">
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
                </p>
              </div>
              {showWarehouseOps ? (
                <div className="mt-3 flex flex-col gap-2">
                  {row.isForecastPending ? (
                    <button
                      type="button"
                      disabled={confirmingId === row.id}
                      onClick={() => {
                        openConfirmModal(row);
                      }}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-500 bg-white px-2.5 py-2 text-sm font-medium text-slate-800"
                    >
                      <PackageCheck className="h-4 w-4" />
                      {confirmingId === row.id ? "处理中..." : "确认入库"}
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={
                        row.isForecastPending ||
                        row.isMinChargeWaived ||
                        waivingId === row.id
                      }
                      onClick={() => {
                        void handleWaive(row.id);
                      }}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-brand/30 px-2.5 py-2 text-sm font-medium text-brand disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {waivingId === row.id ? "处理中..." : "豁免低消"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
          {!loading && rows.length === 0 ? (
            <p className="rounded-xl border border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
              暂无匹配运单
            </p>
          ) : null}
        </div>
      </section>

      <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-3 text-left font-medium">单号</th>
                <th className="px-3 py-2 text-left font-medium">唛头</th>
                <th className="px-3 py-3 text-left font-medium">仓库</th>
                <th className="px-3 py-3 text-left font-medium">方式</th>
                <th className="px-3 py-3 text-left font-medium">实际体积</th>
                <th className="px-3 py-3 text-left font-medium">实际重量</th>
                <th className="px-3 py-3 text-left font-medium">最终费用</th>
                {showWarehouseOps ? (
                  <th className="px-3 py-3 text-left font-medium">操作</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-slate-100 ${
                    row.isForecastPending ? "bg-slate-100 text-slate-600" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-brand">
                      <span
                        className={
                          row.isForecastPending ? "text-slate-700" : undefined
                        }
                      >
                        {row.trackingNumber}
                      </span>
                      {row.isForecastPending ? (
                        <span className="rounded-full bg-slate-300/90 px-2 py-0.5 text-xs font-normal text-slate-800">
                          预报
                        </span>
                      ) : null}
                    </div>
                    {row.isForecastPending &&
                    (row.domesticTracking || row.goodsName) ? (
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        {row.domesticTracking
                          ? `快递 ${row.domesticTracking}`
                          : ""}
                        {row.goodsName ? ` · ${row.goodsName}` : ""}
                        {(row.estimatedPieces ?? 0) > 0
                          ? ` · 预估${row.estimatedPieces ?? 0}件`
                          : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-[100px] truncate px-2 py-2 align-middle font-mono text-xs text-slate-800">
                    {displayShippingMark(row)}
                  </td>
                  <td className="px-3 py-3">{WAREHOUSE_LABEL[row.warehouse]}</td>
                  <td className="px-3 py-3">
                    {SHIPPING_LABEL[row.shippingMethod]}
                  </td>
                  <td className="px-3 py-3">{row.actualCBM.toFixed(3)} CBM</td>
                  <td className="px-3 py-3">{row.actualWeight.toFixed(2)} KG</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-slate-800">
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
                  {showWarehouseOps ? (
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-2">
                        {row.isForecastPending ? (
                          <button
                            type="button"
                            disabled={confirmingId === row.id}
                            onClick={() => {
                              openConfirmModal(row);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-500 px-2.5 py-1.5 text-xs font-medium text-slate-800"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            {confirmingId === row.id ? "处理中..." : "确认入库"}
                          </button>
                        ) : null}
                        {isAdmin ? (
                          <button
                            type="button"
                            disabled={
                              row.isForecastPending ||
                              row.isMinChargeWaived ||
                              waivingId === row.id
                            }
                            onClick={() => {
                              void handleWaive(row.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-brand/30 px-2.5 py-1.5 text-xs font-medium text-brand disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {waivingId === row.id ? "处理中..." : "豁免低消"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={emptyColSpan}
                    className="px-3 py-8 text-center text-slate-400"
                  >
                    暂无匹配运单
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {confirmRow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeConfirmModal();
            }
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-[96vw] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-inbound-title"
          >
            <h2
              id="confirm-inbound-title"
              className="text-lg font-semibold text-slate-900"
            >
              确认入库
            </h2>
            <p className="mt-1 font-mono text-sm text-brand">
              {confirmRow.trackingNumber}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              预报单将转为正式单号（优先去除 YB 前缀）。请按 SKU 逐行录入，系统自动汇总体积与重量并联动计费。
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600">运输方式</span>
                <select
                  value={ciMethod}
                  onChange={(e) => {
                    setCiMethod(e.target.value as BillRow["shippingMethod"]);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="SEA">海运（低消 0.5 CBM）</option>
                  <option value="LAND">陆运（低消 0.3 CBM）</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">单价（¥ / CBM）</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={ciPrice}
                  onChange={(e) => {
                    setCiPrice(e.target.value);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[1500px] w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-2 text-left">产品名称</th>
                      <th className="px-2 py-2 text-left">箱数</th>
                      <th className="px-2 py-2 text-left">产品类型</th>
                      <th className="px-2 py-2 text-left">每箱产品数</th>
                      <th className="px-2 py-2 text-left">国内单号</th>
                      <th className="px-2 py-2 text-left">入库单号</th>
                      <th className="px-2 py-2 text-left">SKU</th>
                      <th className="px-2 py-2 text-left">箱号</th>
                      <th className="px-2 py-2 text-left">长(cm)</th>
                      <th className="px-2 py-2 text-left">宽(cm)</th>
                      <th className="px-2 py-2 text-left">高(cm)</th>
                      <th className="px-2 py-2 text-left">单件重(KG)</th>
                      <th className="px-2 py-2 text-left">总重(KG)</th>
                      <th className="px-2 py-2 text-left">单件体积(CBM)</th>
                      <th className="px-2 py-2 text-left">总体积(CBM)</th>
                      <th className="px-2 py-2 text-left">起始箱号</th>
                      <th className="px-2 py-2 text-left">结束箱号</th>
                      <th className="px-2 py-2 text-left">备注</th>
                      <th className="px-2 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ciProducts.map((row) => {
                      const boxes = Number.parseInt(row.boxCount, 10);
                      const l = Number.parseFloat(row.lengthCm);
                      const w = Number.parseFloat(row.widthCm);
                      const h = Number.parseFloat(row.heightCm);
                      const uw = Number.parseFloat(row.unitWeightKg);
                      const safeBoxes = Number.isNaN(boxes) || boxes < 0 ? 0 : boxes;
                      const unitVol =
                        !Number.isNaN(l) && !Number.isNaN(w) && !Number.isNaN(h) && l > 0 && w > 0 && h > 0
                          ? (l * w * h) / 1_000_000
                          : 0;
                      const totalVol = unitVol * safeBoxes;
                      const totalWeight =
                        (!Number.isNaN(uw) && uw > 0 ? uw : 0) * safeBoxes;
                      return (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="p-1"><input value={row.productName} onChange={(e)=>updateCiProduct(row.key,{productName:e.target.value})} className="w-28 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.boxCount} onChange={(e)=>updateCiProduct(row.key,{boxCount:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><select value={row.cargoType} onChange={(e)=>updateCiProduct(row.key,{cargoType:e.target.value as InboundProductRow['cargoType']})} className="w-20 rounded border border-slate-200 px-1 py-1"><option value="GENERAL">普货</option><option value="SENSITIVE">敏感</option><option value="INSPECTION">商检</option></select></td>
                          <td className="p-1"><input value={row.unitsPerBox} onChange={(e)=>updateCiProduct(row.key,{unitsPerBox:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.domesticTracking} onChange={(e)=>updateCiProduct(row.key,{domesticTracking:e.target.value})} className="w-28 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.inboundTracking} onChange={(e)=>updateCiProduct(row.key,{inboundTracking:e.target.value})} className="w-28 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.sku} onChange={(e)=>updateCiProduct(row.key,{sku:e.target.value})} className="w-20 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.boxNumber} onChange={(e)=>updateCiProduct(row.key,{boxNumber:e.target.value})} className="w-20 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.lengthCm} onChange={(e)=>updateCiProduct(row.key,{lengthCm:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.widthCm} onChange={(e)=>updateCiProduct(row.key,{widthCm:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.heightCm} onChange={(e)=>updateCiProduct(row.key,{heightCm:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.unitWeightKg} onChange={(e)=>updateCiProduct(row.key,{unitWeightKg:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1 text-right tabular-nums">{totalWeight.toFixed(3)}</td>
                          <td className="p-1 text-right tabular-nums">{unitVol.toFixed(4)}</td>
                          <td className="p-1 text-right tabular-nums">{totalVol.toFixed(4)}</td>
                          <td className="p-1"><input value={row.startBoxNo} onChange={(e)=>updateCiProduct(row.key,{startBoxNo:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.endBoxNo} onChange={(e)=>updateCiProduct(row.key,{endBoxNo:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1"><input value={row.remark} onChange={(e)=>updateCiProduct(row.key,{remark:e.target.value})} className="w-24 rounded border border-slate-200 px-1 py-1" /></td>
                          <td className="p-1">
                            <button type="button" onClick={() => { removeCiProductRow(row.key); }} className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600">删行</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addCiProductRow}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                + 新增行
              </button>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ciWaive}
                  onChange={(e) => {
                    setCiWaive(e.target.checked);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-600">豁免低消</span>
              </label>
            </div>

            {previewCharge ? (
              <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="text-slate-500">
                  汇总：{ciSummary.totalBoxes} 箱 / {ciSummary.totalWeight.toFixed(3)} KG / {ciSummary.totalVolume.toFixed(4)} CBM
                </p>
                <p className="text-slate-500">预估最终待支付</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  <CurrencyAmount value={previewCharge.finalCharge} />
                  {!ciWaive && previewCharge.minChargeDifferenceFee > 0 ? (
                    <span className="ml-2 text-xs font-normal text-amber-700">
                      （含低消补差）
                    </span>
                  ) : null}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                请填写有效产品明细与单价以预览金额。
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirmModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                disabled={confirmingId !== null}
                onClick={() => {
                  void handleConfirmInbound();
                }}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {confirmingId ? "提交中…" : "确认并计费"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
