"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PackageCheck } from "lucide-react";
import { CurrencyAmount } from "@/app/components/CurrencyAmount";
import { calculateCharge } from "@/lib/core/charge-formulas";

type Warehouse = "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
type ShippingMethod = "SEA" | "LAND";
type CargoType = "GENERAL" | "SENSITIVE" | "INSPECTION";
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

const WAREHOUSE_OPTIONS: Array<{ value: Warehouse; label: string }> = [
  { value: "YIWU", label: "义乌仓" },
  { value: "GUANGZHOU", label: "广州仓" },
  { value: "SHENZHEN", label: "深圳仓" },
  { value: "DONGGUAN", label: "东莞仓" },
];

/**
 * 创建空明细行。
 */
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

/**
 * 员工直接入库：创建 XT 正式单并录入详细产品信息。
 */
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
  const [error, setError] = useState<string>("");
  const [successNo, setSuccessNo] = useState<string>("");

  /**
   * 拉取客户列表供员工绑定。
   */
  useEffect(() => {
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

  /**
   * 更新某行字段。
   */
  function updateRow(key: string, patch: Partial<ProductRow>): void {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /**
   * 新增行。
   */
  function addRow(): void {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  /**
   * 删除行（至少保留一行）。
   */
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

  /**
   * 按客户与运输方式读取管理员设置的最新单价（含客户专属价/折扣）。
   */
  useEffect(() => {
    if (!clientUserId) {
      return;
    }
    void (async () => {
      setPriceLoading(true);
      try {
        const response = await fetch(
          `/api/staff/pricing-settings?clientUserId=${encodeURIComponent(clientUserId)}`,
          {
            credentials: "include",
          }
        );
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          seaPrice: number;
          landPrice: number;
          shippingMark: string;
        };
        setShippingMark(data.shippingMark ?? shippingMark);
        setUnitPrice(
          String(shippingMethod === "SEA" ? data.seaPrice : data.landPrice)
        );
      } finally {
        setPriceLoading(false);
      }
    })();
  }, [clientUserId, shippingMethod]);

  /**
   * 提交 XT 正式单创建。
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setSuccessNo("");
    const price = Number.parseFloat(unitPrice);
    const hasInvalid = rows.some((r) => {
      const name = r.productName.trim();
      const boxes = Number.parseInt(r.boxCount, 10);
      const units = Number.parseInt(r.unitsPerBox, 10);
      return !name || Number.isNaN(boxes) || boxes < 1 || Number.isNaN(units) || units < 1;
    });
    if (Number.isNaN(price) || price < 0 || hasInvalid) {
      setError("请填写有效的产品明细与单价。");
      return;
    }
    if (!clientUserId) {
      setError("请选择所属客户。");
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
      const data = (await response.json()) as { message?: string; bill?: { trackingNumber: string } };
      if (!response.ok) {
        throw new Error(data.message ?? "创建失败");
      }
      setSuccessNo(data.bill?.trackingNumber ?? "");
      setRows([createEmptyRow()]);
      setUnitPrice("");
      setIsMinChargeWaived(false);
      setClientUserId("");
      setShippingMark("");
      setCustomerQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[95vw] px-4 py-6">
      <h1 className="text-2xl font-semibold text-brand">直接入库（新建正式单）</h1>
      <p className="mt-2 text-sm text-slate-600">本页仅创建 XT 正式运单，不会创建 YB 客户预报单。</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">仓库</span>
            <select value={warehouse} onChange={(e) => setWarehouse(e.target.value as Warehouse)} className="w-full rounded border border-slate-200 px-2 py-2">
              {WAREHOUSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">运输方式</span>
            <select value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)} className="w-full rounded border border-slate-200 px-2 py-2">
              <option value="SEA">海运（低消 0.5）</option>
              <option value="LAND">陆运（低消 0.3）</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">单价（¥ / CBM）</span>
            <input value={unitPrice} readOnly className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-2" />
            <span className="mt-1 block text-[11px] text-slate-500">
              {priceLoading ? "读取中..." : "自动读取管理员单价（含客户专属价）"}
            </span>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={isMinChargeWaived} onChange={(e) => setIsMinChargeWaived(e.target.checked)} />
            豁免低消
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">所属客户（可搜索）</span>
            <input
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="输入登录名/姓名搜索"
              className="w-full rounded border border-slate-200 px-2 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">客户选择</span>
            <select
              value={clientUserId}
              onChange={(e) => {
                const id = e.target.value;
                setClientUserId(id);
                const picked = customers.find((c) => c.id === id);
                setShippingMark(picked?.username ?? "");
              }}
              className="w-full rounded border border-slate-200 px-2 py-2"
            >
              <option value="">请选择客户</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.username}
                  {c.realName ? `（${c.realName}）` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">唛头（自动关联客户登录名）</span>
          <input value={shippingMark} readOnly className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-2 font-mono" />
        </label>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1500px] w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-2 text-left">产品名称</th><th className="px-2 py-2 text-left">箱数</th><th className="px-2 py-2 text-left">产品类型</th><th className="px-2 py-2 text-left">每箱产品数</th>
                <th className="px-2 py-2 text-left">国内单号</th><th className="px-2 py-2 text-left">入库单号</th><th className="px-2 py-2 text-left">SKU</th><th className="px-2 py-2 text-left">箱号</th>
                <th className="px-2 py-2 text-left">长</th><th className="px-2 py-2 text-left">宽</th><th className="px-2 py-2 text-left">高</th><th className="px-2 py-2 text-left">单件重</th>
                <th className="px-2 py-2 text-left">总重</th><th className="px-2 py-2 text-left">单件体积</th><th className="px-2 py-2 text-left">总体积</th>
                <th className="px-2 py-2 text-left">起始箱号</th><th className="px-2 py-2 text-left">结束箱号</th><th className="px-2 py-2 text-left">备注</th><th className="px-2 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const boxes = Number.parseInt(r.boxCount, 10);
                const safeBoxes = Number.isNaN(boxes) || boxes < 0 ? 0 : boxes;
                const l = Number.parseFloat(r.lengthCm); const w = Number.parseFloat(r.widthCm); const h = Number.parseFloat(r.heightCm);
                const uw = Number.parseFloat(r.unitWeightKg);
                const unitVol = !Number.isNaN(l) && !Number.isNaN(w) && !Number.isNaN(h) && l>0 && w>0 && h>0 ? (l*w*h)/1_000_000 : 0;
                const totalVol = unitVol * safeBoxes;
                const totalWeight = (!Number.isNaN(uw) && uw > 0 ? uw : 0) * safeBoxes;
                return (
                  <tr key={r.key} className="border-t border-slate-100">
                    <td className="p-1"><input value={r.productName} onChange={(e)=>updateRow(r.key,{productName:e.target.value})} className="w-28 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.boxCount} onChange={(e)=>updateRow(r.key,{boxCount:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><select value={r.cargoType} onChange={(e)=>updateRow(r.key,{cargoType:e.target.value as CargoType})} className="w-20 rounded border border-slate-200 px-1 py-1"><option value="GENERAL">普货</option><option value="SENSITIVE">敏感</option><option value="INSPECTION">商检</option></select></td>
                    <td className="p-1"><input value={r.unitsPerBox} onChange={(e)=>updateRow(r.key,{unitsPerBox:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.domesticTracking} onChange={(e)=>updateRow(r.key,{domesticTracking:e.target.value})} className="w-24 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.inboundTracking} onChange={(e)=>updateRow(r.key,{inboundTracking:e.target.value})} className="w-24 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.sku} onChange={(e)=>updateRow(r.key,{sku:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.boxNumber} onChange={(e)=>updateRow(r.key,{boxNumber:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.lengthCm} onChange={(e)=>updateRow(r.key,{lengthCm:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.widthCm} onChange={(e)=>updateRow(r.key,{widthCm:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.heightCm} onChange={(e)=>updateRow(r.key,{heightCm:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.unitWeightKg} onChange={(e)=>updateRow(r.key,{unitWeightKg:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1 text-right tabular-nums">{totalWeight.toFixed(3)}</td>
                    <td className="p-1 text-right tabular-nums">{unitVol.toFixed(4)}</td>
                    <td className="p-1 text-right tabular-nums">{totalVol.toFixed(4)}</td>
                    <td className="p-1"><input value={r.startBoxNo} onChange={(e)=>updateRow(r.key,{startBoxNo:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.endBoxNo} onChange={(e)=>updateRow(r.key,{endBoxNo:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><input value={r.remark} onChange={(e)=>updateRow(r.key,{remark:e.target.value})} className="w-24 rounded border border-slate-200 px-1 py-1" /></td>
                    <td className="p-1"><button type="button" onClick={() => { removeRow(r.key); }} className="rounded border border-slate-200 px-2 py-1">删行</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={addRow} className="rounded border border-slate-200 px-3 py-1.5 text-sm">+ 新增行</button>
          <p className="text-xs text-slate-600">汇总：{summary.totalBoxes} 箱 / {summary.totalWeight.toFixed(3)} KG / {summary.totalVolume.toFixed(4)} CBM</p>
        </div>

        {chargePreview ? (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <p className="text-slate-500">预估运费</p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              <CurrencyAmount value={chargePreview.finalCharge} />
            </p>
          </div>
        ) : null}

        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
          <PackageCheck className="h-4 w-4" />
          {submitting ? "提交中..." : "保存 XT 正式单"}
        </button>
        <p className="text-sm">
          <Link href="/staff/forecast-inbound" className="text-brand underline-offset-2 hover:underline">前往客户预报单查询</Link>
        </p>
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {successNo ? <p className="mt-3 text-sm text-emerald-700">创建成功：{successNo}</p> : null}
    </main>
  );
}
