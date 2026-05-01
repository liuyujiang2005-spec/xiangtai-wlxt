"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageCheck, X } from "lucide-react";
import { CurrencyAmount } from "@/app/components/CurrencyAmount";
import { calculateCharge } from "@/lib/core/charge-formulas";

type Warehouse = "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
type ShippingMethod = "SEA" | "LAND";
type CargoType = "GENERAL" | "SENSITIVE" | "INSPECTION";
type ShipmentStatus =
  | "ORDERED"
  | "PENDING_INBOUND"
  | "INBOUND_CONFIRMED"
  | "LOADED"
  | "SHIPPED"
  | "CUSTOMS_CLEARING"
  | "ARRIVED_TH"
  | "OUT_FOR_DELIVERY"
  | "SIGNED";

type CustomerOption = {
  id: string;
  username: string;
  realName: string | null;
};

type ProductRow = {
  key: string;
  productName: string;
  boxCount: string;
  cargoType: CargoType;
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

type BillRow = {
  id: string;
  trackingNumber: string;
  clientLogin: string | null;
  shipmentStatus: ShipmentStatus;
  shippingMethod: ShippingMethod;
  createdAt?: string;
  totalPackages?: number | null;
  actualWeight?: number;
  actualCBM?: number;
  domesticTracking?: string | null;
};

const WAREHOUSE_OPTIONS: Array<{ value: Warehouse; label: string }> = [
  { value: "YIWU", label: "义乌仓" },
  { value: "GUANGZHOU", label: "广州仓" },
  { value: "SHENZHEN", label: "深圳仓" },
  { value: "DONGGUAN", label: "东莞仓" },
];

const STATUS_LABEL: Record<ShipmentStatus, string> = {
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

function createEmptyRow(): ProductRow {
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

export default function StaffDirectInboundPage(): React.ReactNode {
  const [warehouse, setWarehouse] = useState<Warehouse>("YIWU");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("SEA");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [isMinChargeWaived, setIsMinChargeWaived] = useState<boolean>(false);
  const [rows, setRows] = useState<ProductRow[]>([createEmptyRow()]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [clientUserId, setClientUserId] = useState("");
  const [shippingMark, setShippingMark] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");
  const [listError, setListError] = useState<string>("");
  const [billQuery, setBillQuery] = useState("");
  const [searchingBill, setSearchingBill] = useState(false);
  const [foundBills, setFoundBills] = useState<BillRow[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [trackingKeyword, setTrackingKeyword] = useState("");
  const [domesticKeyword, setDomesticKeyword] = useState("");
  const [appliedTrackingKeyword, setAppliedTrackingKeyword] = useState("");
  const [appliedDomesticKeyword, setAppliedDomesticKeyword] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listRows, setListRows] = useState<BillRow[]>([]);

  async function searchBills() {
    const q = billQuery.trim();
    if (!q) return;
    setSearchingBill(true);
    try {
      const response = await fetch(
        `/api/transport-bills?query=${encodeURIComponent(q)}&pageSize=50`,
        { credentials: "include" }
      );
      if (!response.ok) return;
      const data = (await response.json()) as { list?: BillRow[] };
      setFoundBills(data.list ?? []);
    } catch {
      setFoundBills([]);
    } finally {
      setSearchingBill(false);
    }
  }

  async function loadBills(): Promise<void> {
    setListLoading(true);
    setListError("");
    try {
      const response = await fetch("/api/transport-bills?page=1&pageSize=200", {
        credentials: "include",
      });
      const data = (await response.json()) as {
        list?: BillRow[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message ?? "运单列表加载失败");
      }
      setListRows(data.list ?? []);
    } catch (e) {
      setListRows([]);
      setListError(e instanceof Error ? e.message : "运单列表加载失败");
    } finally {
      setListLoading(false);
    }
  }

  function resetCreateForm(): void {
    setWarehouse("YIWU");
    setShippingMethod("SEA");
    setUnitPrice("");
    setIsMinChargeWaived(false);
    setRows([createEmptyRow()]);
    setCustomerQuery("");
    setClientUserId("");
    setShippingMark("");
    setFormError("");
    setBillQuery("");
    setFoundBills([]);
  }

  function openCreateModal(): void {
    resetCreateForm();
    setIsCreateOpen(true);
  }

  function closeCreateModal(): void {
    setIsCreateOpen(false);
    setFormError("");
  }

  useEffect(() => {
    void loadBills();
    void (async () => {
      try {
        const response = await fetch("/api/staff/customers", {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { list?: CustomerOption[] };
        setCustomers(data.list ?? []);
      } catch {
        setCustomers([]);
      }
    })();
  }, []);

  function updateRow(key: string, patch: Partial<ProductRow>): void {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow(): void {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function removeRow(key: string): void {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  const summary = useMemo(() => {
    let totalWeight = 0;
    let totalVolume = 0;
    let totalBoxes = 0;
    for (const r of rows) {
      const boxes = Number.parseInt(r.boxCount, 10);
      const l = Number.parseFloat(r.lengthCm);
      const w = Number.parseFloat(r.widthCm);
      const h = Number.parseFloat(r.heightCm);
      const uw = Number.parseFloat(r.unitWeightKg);
      const safeBoxes = Number.isNaN(boxes) || boxes < 0 ? 0 : boxes;
      const unitVolume =
        !Number.isNaN(l) && !Number.isNaN(w) && !Number.isNaN(h) && l > 0 && w > 0 && h > 0
          ? (l * w * h) / 1_000_000
          : 0;
      const unitWeight = !Number.isNaN(uw) && uw > 0 ? uw : 0;
      totalBoxes += safeBoxes;
      totalWeight += unitWeight * safeBoxes;
      totalVolume += unitVolume * safeBoxes;
    }
    return { totalBoxes, totalWeight, totalVolume };
  }, [rows]);

  const chargePreview = useMemo(() => {
    const price = Number.parseFloat(unitPrice);
    if (Number.isNaN(price) || price < 0) {
      return null;
    }
    return calculateCharge({
      shippingMethod,
      actualCBM: summary.totalVolume,
      unitPrice: price,
      isMinChargeWaived,
    });
  }, [unitPrice, shippingMethod, summary.totalVolume, isMinChargeWaived]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) {
      return customers;
    }
    return customers.filter((c) => {
      const text = `${c.username} ${c.realName ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [customers, customerQuery]);

  const filteredBills = useMemo(() => {
    const tracking = appliedTrackingKeyword.trim().toLowerCase();
    const domestic = appliedDomesticKeyword.trim().toLowerCase();
    return listRows.filter((row) => {
      const matchTracking = tracking
        ? row.trackingNumber.toLowerCase().includes(tracking)
        : true;
      const matchDomestic = domestic
        ? (row.domesticTracking ?? "").toLowerCase().includes(domestic)
        : true;
      return matchTracking && matchDomestic;
    });
  }, [appliedDomesticKeyword, appliedTrackingKeyword, listRows]);

  useEffect(() => {
    if (!clientUserId) {
      return;
    }
    void (async () => {
      setPriceLoading(true);
      try {
        const response = await fetch(
          `/api/staff/pricing-settings?clientUserId=${encodeURIComponent(clientUserId)}`,
          { credentials: "include" }
        );
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          seaPrice: number;
          landPrice: number;
          shippingMark: string;
        };
        setShippingMark((prev) => data.shippingMark ?? prev);
        setUnitPrice(
          String(shippingMethod === "SEA" ? data.seaPrice : data.landPrice)
        );
      } finally {
        setPriceLoading(false);
      }
    })();
  }, [clientUserId, shippingMethod]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError("");
    const price = Number.parseFloat(unitPrice);
    const hasInvalid = rows.some((r) => {
      const name = r.productName.trim();
      const boxes = Number.parseInt(r.boxCount, 10);
      const units = Number.parseInt(r.unitsPerBox, 10);
      return !name || Number.isNaN(boxes) || boxes < 1 || Number.isNaN(units) || units < 1;
    });
    if (Number.isNaN(price) || price < 0 || hasInvalid) {
      setFormError("请填写有效的产品明细与单价。");
      return;
    }
    if (!clientUserId) {
      setFormError("请选择所属客户。");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/transport-bills", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse,
          shippingMethod,
          clientUserId,
          unitPrice: price,
          isMinChargeWaived,
          products: rows.map((r) => ({
            productName: r.productName.trim(),
            boxCount: Number.parseInt(r.boxCount, 10),
            cargoType: r.cargoType,
            unitsPerBox: Number.parseInt(r.unitsPerBox, 10),
            domesticTracking: r.domesticTracking.trim() || undefined,
            inboundTracking: r.inboundTracking.trim() || undefined,
            sku: r.sku.trim() || undefined,
            boxNumber: r.boxNumber.trim() || undefined,
            lengthCm: r.lengthCm.trim() ? Number.parseFloat(r.lengthCm) : undefined,
            widthCm: r.widthCm.trim() ? Number.parseFloat(r.widthCm) : undefined,
            heightCm: r.heightCm.trim() ? Number.parseFloat(r.heightCm) : undefined,
            unitWeightKg: r.unitWeightKg.trim()
              ? Number.parseFloat(r.unitWeightKg)
              : undefined,
            startBoxNo: r.startBoxNo.trim() ? Number.parseInt(r.startBoxNo, 10) : undefined,
            endBoxNo: r.endBoxNo.trim() ? Number.parseInt(r.endBoxNo, 10) : undefined,
            remark: r.remark.trim() || undefined,
          })),
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        bill?: { trackingNumber: string };
      };
      if (!response.ok) {
        throw new Error(data.message ?? "创建失败");
      }
      closeCreateModal();
      resetCreateForm();
      await loadBills();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  function exportCsv(): void {
    const header = [
      "运单号",
      "所属用户",
      "状态",
      "运输方式",
      "发货时间",
      "总件数",
      "总重量",
      "总体积",
      "国内单号",
    ];
    const lines = filteredBills.map((row) =>
      [
        row.trackingNumber,
        row.clientLogin ?? "",
        STATUS_LABEL[row.shipmentStatus] ?? row.shipmentStatus,
        row.shippingMethod === "SEA" ? "海运" : "陆运",
        row.createdAt
          ? new Date(row.createdAt).toLocaleString("zh-CN")
          : "",
        row.totalPackages ?? "",
        row.actualWeight ?? "",
        row.actualCBM ?? "",
        row.domesticTracking ?? "",
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
    a.download = `staff-inbound-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto w-full max-w-[95vw] px-4 py-6">
      <h1 className="text-2xl font-semibold text-brand">运单管理（入库处理）</h1>
      <p className="mt-2 text-sm text-slate-600">
        页面默认仅展示运单列表；新建正式单通过右上角弹窗完成。
      </p>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm text-slate-600">运单号:</span>
            <input
              value={trackingKeyword}
              onChange={(e) => setTrackingKeyword(e.target.value)}
              placeholder="请输入入库单号"
              className="w-48 rounded border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm text-slate-600">国内单号:</span>
            <input
              value={domesticKeyword}
              onChange={(e) => setDomesticKeyword(e.target.value)}
              placeholder="请输入国内单号"
              className="w-48 rounded border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setAppliedTrackingKeyword(trackingKeyword);
              setAppliedDomesticKeyword(domesticKeyword);
            }}
            className="rounded bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            查询
          </button>
          <button
            type="button"
            onClick={() => {
              setTrackingKeyword("");
              setDomesticKeyword("");
              setAppliedTrackingKeyword("");
              setAppliedDomesticKeyword("");
            }}
            className="rounded border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            重置
          </button>
          <button
            type="button"
            className="ml-2 flex items-center text-sm text-blue-500 hover:underline"
          >
            展开 ▾
          </button>
        </div>

        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            导出
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
          >
            新增
          </button>
        </div>
      </div>

      {listError ? <p className="mt-3 text-sm text-red-600">{listError}</p> : null}

      <div className="mt-4 overflow-hidden rounded border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
            i
          </div>
          <span className="text-sm text-slate-700">未选中任何数据</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="w-10 px-2 py-3 text-center font-medium">+</th>
                <th className="w-10 px-2 py-3 text-center font-medium">
                  <input type="checkbox" disabled />
                </th>
                <th className="px-3 py-3 text-left font-medium">运单号</th>
                <th className="px-3 py-3 text-left font-medium">运单所属用户</th>
                <th className="px-3 py-3 text-left font-medium">运单状态</th>
                <th className="px-3 py-3 text-left font-medium">加收金额</th>
                <th className="px-3 py-3 text-left font-medium">运输方式</th>
                <th className="px-3 py-3 text-left font-medium">发货时间</th>
                <th className="px-3 py-3 text-left font-medium">总件数</th>
                <th className="px-3 py-3 text-left font-medium">总重量</th>
                <th className="px-3 py-3 text-left font-medium">总体积</th>
                <th className="px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                    暂无运单数据
                  </td>
                </tr>
              ) : (
                filteredBills.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50"
                  >
                    <td className="px-2 py-3 text-center text-slate-400">+</td>
                    <td className="px-2 py-3 text-center">
                      <input type="checkbox" disabled />
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-700">
                      {row.trackingNumber}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {row.clientLogin ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {STATUS_LABEL[row.shipmentStatus] ?? row.shipmentStatus}
                    </td>
                    <td className="px-3 py-3 text-slate-700">0</td>
                    <td className="px-3 py-3 text-slate-700">
                      {row.shippingMethod === "SEA" ? "海运" : "陆运"}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleString("zh-CN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {row.totalPackages ?? 0}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {(row.actualWeight ?? 0).toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {(row.actualCBM ?? 0).toFixed(4)}
                    </td>
                    <td className="px-3 py-3 text-brand">
                      <button type="button" className="hover:underline">
                        更多 ▾
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-[8vh]">
          <div className="w-full max-w-[96vw] rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-brand-dark">新增正式单</h2>
              <button
                type="button"
                onClick={closeCreateModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto px-6 py-5">
              <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">基本信息</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="mb-1.5 block font-medium text-slate-700">仓库</span>
                    <select
                      value={warehouse}
                      onChange={(e) => setWarehouse(e.target.value as Warehouse)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      {WAREHOUSE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block font-medium text-slate-700">运输方式</span>
                    <select
                      value={shippingMethod}
                      onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="SEA">海运</option>
                      <option value="LAND">陆运</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block font-medium text-slate-700">单价（¥ / CBM）</span>
                    <input
                      value={unitPrice}
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {priceLoading ? "读取中..." : "选择客户后自动读取"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">客户与运单</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="relative text-sm">
                    <span className="mb-1.5 block font-medium text-slate-700">所属客户搜索</span>
                    <input
                      value={customerQuery}
                      onChange={(e) => {
                        setCustomerQuery(e.target.value);
                        setClientUserId("");
                        setShippingMark("");
                      }}
                      placeholder="输入客户名或姓名搜索"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none ring-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  {customerQuery && !clientUserId ? (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((c) => (
                          <li
                            key={c.id}
                            onClick={() => {
                              setClientUserId(c.id);
                              setShippingMark(c.username);
                              setCustomerQuery(
                                `${c.username} ${c.realName ? `(${c.realName})` : ""}`
                              );
                            }}
                            className="cursor-pointer px-3 py-2 hover:bg-slate-100"
                          >
                            {c.username} {c.realName ? `（${c.realName}）` : ""}
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-2 text-slate-500">无匹配客户</li>
                      )}
                    </ul>
                  ) : null}
                </div>

                  <label className="text-sm">
                    <span className="mb-1.5 block font-medium text-slate-700">运单搜索（选填）</span>
                    <div className="flex gap-2">
                      <input
                        value={billQuery}
                        onChange={(e) => setBillQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void searchBills();
                          }
                        }}
                        placeholder="输入单号或产品名模糊搜索"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none ring-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void searchBills();
                        }}
                        disabled={searchingBill}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        {searchingBill ? "..." : "搜索"}
                      </button>
                    </div>
                  {foundBills.length > 0 ? (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                      <p className="mb-2 text-xs text-slate-500">匹配的运单记录：</p>
                      <ul className="space-y-2">
                        {foundBills.map((bill) => (
                          <li key={bill.id} className="rounded bg-slate-50 p-2 text-xs">
                            <div className="font-medium text-brand-dark">
                              {bill.trackingNumber}
                            </div>
                            <div className="mt-1 text-slate-600">
                              客户: {bill.clientLogin ?? "—"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </label>
              </div>
              </div>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">唛头（自动关联客户登录名）</span>
                <input
                  value={shippingMark}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-600"
                />
              </label>

              <div className="space-y-3 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">产品明细</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-[1500px] w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-2 text-left">入库单号</th>
                      <th className="px-2 py-2 text-left">产品名称</th>
                      <th className="px-2 py-2 text-left">箱数</th>
                      <th className="px-2 py-2 text-left">产品类型</th>
                      <th className="px-2 py-2 text-left">每箱产品数</th>
                      <th className="px-2 py-2 text-left">国内单号</th>
                      <th className="px-2 py-2 text-left">SKU</th>
                      <th className="px-2 py-2 text-left">箱号</th>
                      <th className="px-2 py-2 text-left">长</th>
                      <th className="px-2 py-2 text-left">宽</th>
                      <th className="px-2 py-2 text-left">高</th>
                      <th className="px-2 py-2 text-left">单件重</th>
                      <th className="px-2 py-2 text-left">总重</th>
                      <th className="px-2 py-2 text-left">单件体积</th>
                      <th className="px-2 py-2 text-left">总体积</th>
                      <th className="px-2 py-2 text-left">起始箱号</th>
                      <th className="px-2 py-2 text-left">结束箱号</th>
                      <th className="px-2 py-2 text-left">备注</th>
                      <th className="px-2 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const boxes = Number.parseInt(row.boxCount, 10);
                      const safeBoxes = Number.isNaN(boxes) || boxes < 0 ? 0 : boxes;
                      const l = Number.parseFloat(row.lengthCm);
                      const w = Number.parseFloat(row.widthCm);
                      const h = Number.parseFloat(row.heightCm);
                      const uw = Number.parseFloat(row.unitWeightKg);
                      const unitVol =
                        !Number.isNaN(l) &&
                        !Number.isNaN(w) &&
                        !Number.isNaN(h) &&
                        l > 0 &&
                        w > 0 &&
                        h > 0
                          ? (l * w * h) / 1_000_000
                          : 0;
                      const totalVol = unitVol * safeBoxes;
                      const totalWeight =
                        (!Number.isNaN(uw) && uw > 0 ? uw : 0) * safeBoxes;
                      return (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="p-1">
                            <input
                              value={row.inboundTracking}
                              onChange={(e) =>
                                updateRow(row.key, { inboundTracking: e.target.value })
                              }
                              className="w-24 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.productName}
                              onChange={(e) =>
                                updateRow(row.key, { productName: e.target.value })
                              }
                              className="w-28 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.boxCount}
                              onChange={(e) =>
                                updateRow(row.key, { boxCount: e.target.value })
                              }
                              className="w-14 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <select
                              value={row.cargoType}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  cargoType: e.target.value as CargoType,
                                })
                              }
                              className="w-20 rounded border border-slate-200 px-1 py-1"
                            >
                              <option value="GENERAL">普货</option>
                              <option value="SENSITIVE">敏感</option>
                              <option value="INSPECTION">商检</option>
                            </select>
                          </td>
                          <td className="p-1">
                            <input
                              value={row.unitsPerBox}
                              onChange={(e) =>
                                updateRow(row.key, { unitsPerBox: e.target.value })
                              }
                              className="w-16 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.domesticTracking}
                              onChange={(e) =>
                                updateRow(row.key, { domesticTracking: e.target.value })
                              }
                              className="w-24 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.sku}
                              onChange={(e) => updateRow(row.key, { sku: e.target.value })}
                              className="w-16 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.boxNumber}
                              onChange={(e) =>
                                updateRow(row.key, { boxNumber: e.target.value })
                              }
                              className="w-16 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.lengthCm}
                              onChange={(e) =>
                                updateRow(row.key, { lengthCm: e.target.value })
                              }
                              className="w-14 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.widthCm}
                              onChange={(e) =>
                                updateRow(row.key, { widthCm: e.target.value })
                              }
                              className="w-14 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.heightCm}
                              onChange={(e) =>
                                updateRow(row.key, { heightCm: e.target.value })
                              }
                              className="w-14 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.unitWeightKg}
                              onChange={(e) =>
                                updateRow(row.key, { unitWeightKg: e.target.value })
                              }
                              className="w-14 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1 text-right tabular-nums">
                            {totalWeight.toFixed(3)}
                          </td>
                          <td className="p-1 text-right tabular-nums">
                            {unitVol.toFixed(4)}
                          </td>
                          <td className="p-1 text-right tabular-nums">
                            {totalVol.toFixed(4)}
                          </td>
                          <td className="p-1">
                            <input
                              value={row.startBoxNo}
                              onChange={(e) =>
                                updateRow(row.key, { startBoxNo: e.target.value })
                              }
                              className="w-14 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.endBoxNo}
                              onChange={(e) =>
                                updateRow(row.key, { endBoxNo: e.target.value })
                              }
                              className="w-14 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={row.remark}
                              onChange={(e) =>
                                updateRow(row.key, { remark: e.target.value })
                              }
                              className="w-24 rounded border border-slate-200 px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <button
                              type="button"
                              onClick={() => {
                                removeRow(row.key);
                              }}
                              className="rounded border border-slate-200 px-2 py-1"
                            >
                              删行
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="请输入国内单号/快递单号"
                    className="w-64 rounded border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          setRows((prev) => {
                            const newRow = createEmptyRow();
                            newRow.domesticTracking = val;
                            if (
                              prev.length === 1 &&
                              !prev[0].domesticTracking &&
                              !prev[0].productName
                            ) {
                              return [newRow];
                            }
                            return [newRow, ...prev];
                          });
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      const val = input.value.trim();
                      if (val) {
                        setRows((prev) => {
                          const newRow = createEmptyRow();
                          newRow.domesticTracking = val;
                          if (
                            prev.length === 1 &&
                            !prev[0].domesticTracking &&
                            !prev[0].productName
                          ) {
                            return [newRow];
                          }
                          return [newRow, ...prev];
                        });
                        input.value = "";
                      } else {
                        addRow();
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
                  >
                    新增单号
                  </button>
                </div>
                <p className="ml-auto text-xs text-slate-500">
                  汇总：{summary.totalBoxes} 箱 / {summary.totalWeight.toFixed(3)} KG /{" "}
                  {summary.totalVolume.toFixed(4)} CBM
                </p>
              </div>
              </div>

              {chargePreview ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">预估运费</p>
                  <p className="mt-1 text-lg font-semibold text-brand-dark">
                    <CurrencyAmount value={chargePreview.finalCharge} />
                  </p>
                </div>
              ) : null}

              {formError ? (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                  >
                    <PackageCheck className="h-4 w-4" />
                    {submitting ? "提交中..." : "保存并关闭"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
