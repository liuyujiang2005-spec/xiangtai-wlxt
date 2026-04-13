"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { calculateCharge } from "@/lib/core/charge-formulas";
import { CurrencyAmount } from "@/app/components/CurrencyAmount";

type ShippingMethod = "SEA" | "LAND";
type CargoType = "GENERAL" | "SENSITIVE" | "INSPECTION";

type ForecastRow = {
  id: string;
  trackingNumber: string;
  warehouse: "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
  shippingMethod: ShippingMethod;
  domesticTracking: string | null;
  goodsName: string | null;
  isForecastPending: boolean;
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

/**
 * 预报转正式页：仅查询 YB 预报并执行入库转换。
 */
export default function StaffForecastInboundPage(): React.ReactNode {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<ForecastRow | null>(null);
  const [method, setMethod] = useState<ShippingMethod>("SEA");
  const [price, setPrice] = useState("");
  const [waive, setWaive] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  /**
   * 创建产品空行。
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
   * 查询预报单列表（仅 YB）。
   */
  async function loadForecasts(searchText: string): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ forecastOnly: "1" });
      if (searchText.trim()) {
        qs.set("query", searchText.trim());
      }
      const response = await fetch(`/api/transport-bills?${qs.toString()}`, {
        credentials: "include",
      });
      const data = (await response.json()) as { list?: ForecastRow[]; message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "加载失败");
      }
      setRows((data.list ?? []).filter((r) => r.trackingNumber.startsWith("YB")));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadForecasts("");
  }, []);

  /**
   * 更新产品某行字段。
   */
  function updateRow(key: string, patch: Partial<ProductRow>): void {
    setProducts((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const summary = useMemo(() => {
    let totalWeight = 0;
    let totalVolume = 0;
    let totalBoxes = 0;
    for (const r of products) {
      const boxes = Number.parseInt(r.boxCount, 10);
      const l = Number.parseFloat(r.lengthCm);
      const w = Number.parseFloat(r.widthCm);
      const h = Number.parseFloat(r.heightCm);
      const uw = Number.parseFloat(r.unitWeightKg);
      const safeBoxes = Number.isNaN(boxes) || boxes < 0 ? 0 : boxes;
      const unitVol = !Number.isNaN(l) && !Number.isNaN(w) && !Number.isNaN(h) && l > 0 && w > 0 && h > 0 ? (l * w * h) / 1_000_000 : 0;
      totalBoxes += safeBoxes;
      totalVolume += unitVol * safeBoxes;
      totalWeight += (!Number.isNaN(uw) && uw > 0 ? uw : 0) * safeBoxes;
    }
    return { totalBoxes, totalWeight, totalVolume };
  }, [products]);

  const chargePreview = useMemo(() => {
    const p = Number.parseFloat(price);
    if (Number.isNaN(p) || p < 0) {
      return null;
    }
    return calculateCharge({
      shippingMethod: method,
      actualCBM: summary.totalVolume,
      unitPrice: p,
      isMinChargeWaived: waive,
    });
  }, [price, method, summary.totalVolume, waive]);

  /**
   * 打开“转正式单”弹窗，并用预报明细预填。
   */
  async function openConvert(row: ForecastRow): Promise<void> {
    setCurrent(row);
    setMethod(row.shippingMethod);
    setPrice("");
    setWaive(false);
    setProducts([createEmptyRow()]);
    try {
      const response = await fetch(`/api/transport-bills/${encodeURIComponent(row.id)}`, {
        credentials: "include",
      });
      const data = (await response.json()) as {
        bill?: {
          billProducts?: Array<{
            productName: string;
            boxCount: number;
            cargoType: CargoType;
            unitsPerBox: number;
            domesticTracking: string | null;
            inboundTracking: string | null;
            sku: string | null;
            boxNumber: string | null;
            lengthCm: number | null;
            widthCm: number | null;
            heightCm: number | null;
            unitWeightKg: number | null;
            startBoxNo: number | null;
            endBoxNo: number | null;
            remark: string | null;
          }>;
        };
      };
      const src = data.bill?.billProducts ?? [];
      if (src.length > 0) {
        setProducts(
          src.map((p) => ({
            key: `${Date.now()}-${Math.random()}`,
            productName: p.productName ?? "",
            boxCount: String(p.boxCount ?? 1),
            cargoType: p.cargoType ?? "GENERAL",
            unitsPerBox: String(p.unitsPerBox ?? 1),
            domesticTracking: p.domesticTracking ?? "",
            inboundTracking: p.inboundTracking ?? "",
            sku: p.sku ?? "",
            boxNumber: p.boxNumber ?? "",
            lengthCm: p.lengthCm?.toString() ?? "",
            widthCm: p.widthCm?.toString() ?? "",
            heightCm: p.heightCm?.toString() ?? "",
            unitWeightKg: p.unitWeightKg?.toString() ?? "",
            startBoxNo: p.startBoxNo?.toString() ?? "",
            endBoxNo: p.endBoxNo?.toString() ?? "",
            remark: p.remark ?? "",
          }))
        );
      }
    } catch {
      // 保持默认空行，允许手填
    }
  }

  /**
   * 提交预报转正式入库。
   */
  async function submitConvert(): Promise<void> {
    if (!current) return;
    const p = Number.parseFloat(price);
    const invalid = products.some((r) => !r.productName.trim() || Number.parseInt(r.boxCount, 10) < 1 || Number.parseInt(r.unitsPerBox, 10) < 1);
    if (Number.isNaN(p) || p < 0 || invalid) {
      setError("请填写有效的产品明细与单价。");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/transport-bills/${encodeURIComponent(current.id)}/confirm-inbound`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingMethod: method,
          unitPrice: p,
          isMinChargeWaived: waive,
          products: products.map((r) => ({
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
            unitWeightKg: r.unitWeightKg.trim() ? Number.parseFloat(r.unitWeightKg) : undefined,
            startBoxNo: r.startBoxNo.trim() ? Number.parseInt(r.startBoxNo, 10) : undefined,
            endBoxNo: r.endBoxNo.trim() ? Number.parseInt(r.endBoxNo, 10) : undefined,
            remark: r.remark.trim() || undefined,
          })),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "入库失败");
      }
      setCurrent(null);
      await loadForecasts(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : "入库失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[95vw] px-4 py-6">
      <h1 className="text-2xl font-semibold text-brand">客户预报单查询</h1>
      <p className="mt-2 text-sm text-slate-600">仅展示 YB 客户预报单，可执行“转正式单入库”。</p>
      <div className="mt-4 flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入YB单号搜索" className="w-72 rounded border border-slate-200 px-3 py-2 text-sm" />
        <button type="button" onClick={() => { void loadForecasts(query); }} className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">查询</button>
        <Link href="/staff/direct-inbound" className="rounded border border-slate-200 px-4 py-2 text-sm">直接入库（XT）</Link>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">单号</th>
              <th className="px-3 py-2 text-left">货名</th>
              <th className="px-3 py-2 text-left">国内单号</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-brand">{r.trackingNumber}</td>
                <td className="px-3 py-2">{r.goodsName ?? "—"}</td>
                <td className="px-3 py-2">{r.domesticTracking ?? "—"}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => { void openConvert(r); }} className="rounded border border-slate-300 px-3 py-1.5 text-xs">转正式单入库</button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">暂无 YB 预报单</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {current ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-[96vw] overflow-y-auto rounded-xl bg-white p-4">
            <h2 className="text-lg font-semibold">转正式单入库</h2>
            <p className="mt-1 text-xs text-slate-500">预报单 {current.trackingNumber} 将转为 XT 正式单。</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm"><span className="mb-1 block text-slate-600">运输方式</span><select value={method} onChange={(e)=>setMethod(e.target.value as ShippingMethod)} className="w-full rounded border border-slate-200 px-2 py-2"><option value="SEA">海运</option><option value="LAND">陆运</option></select></label>
              <label className="text-sm"><span className="mb-1 block text-slate-600">单价</span><input value={price} onChange={(e)=>setPrice(e.target.value)} className="w-full rounded border border-slate-200 px-2 py-2" /></label>
              <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={waive} onChange={(e)=>setWaive(e.target.checked)} />豁免低消</label>
            </div>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[1400px] w-full text-xs">
                <thead className="bg-slate-50"><tr><th className="px-2 py-2 text-left">产品名称</th><th className="px-2 py-2 text-left">箱数</th><th className="px-2 py-2 text-left">类型</th><th className="px-2 py-2 text-left">每箱数</th><th className="px-2 py-2 text-left">国内单号</th><th className="px-2 py-2 text-left">入库单号</th><th className="px-2 py-2 text-left">SKU</th><th className="px-2 py-2 text-left">箱号</th><th className="px-2 py-2 text-left">长</th><th className="px-2 py-2 text-left">宽</th><th className="px-2 py-2 text-left">高</th><th className="px-2 py-2 text-left">单件重</th><th className="px-2 py-2 text-left">总重</th><th className="px-2 py-2 text-left">单件体积</th><th className="px-2 py-2 text-left">总体积</th><th className="px-2 py-2 text-left">起始箱号</th><th className="px-2 py-2 text-left">结束箱号</th><th className="px-2 py-2 text-left">备注</th></tr></thead>
                <tbody>
                  {products.map((r) => {
                    const boxes = Number.parseInt(r.boxCount, 10); const safe = Number.isNaN(boxes)||boxes<0?0:boxes;
                    const l=Number.parseFloat(r.lengthCm), w=Number.parseFloat(r.widthCm), h=Number.parseFloat(r.heightCm), uw=Number.parseFloat(r.unitWeightKg);
                    const uv=!Number.isNaN(l)&&!Number.isNaN(w)&&!Number.isNaN(h)&&l>0&&w>0&&h>0?(l*w*h)/1_000_000:0;
                    const tv=uv*safe; const tw=(!Number.isNaN(uw)&&uw>0?uw:0)*safe;
                    return <tr key={r.key} className="border-t border-slate-100">
                      <td className="p-1"><input value={r.productName} onChange={(e)=>updateRow(r.key,{productName:e.target.value})} className="w-28 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.boxCount} onChange={(e)=>updateRow(r.key,{boxCount:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><select value={r.cargoType} onChange={(e)=>updateRow(r.key,{cargoType:e.target.value as CargoType})} className="w-20 rounded border border-slate-200 px-1 py-1"><option value="GENERAL">普货</option><option value="SENSITIVE">敏感</option><option value="INSPECTION">商检</option></select></td>
                      <td className="p-1"><input value={r.unitsPerBox} onChange={(e)=>updateRow(r.key,{unitsPerBox:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.domesticTracking} onChange={(e)=>updateRow(r.key,{domesticTracking:e.target.value})} className="w-20 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.inboundTracking} onChange={(e)=>updateRow(r.key,{inboundTracking:e.target.value})} className="w-20 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.sku} onChange={(e)=>updateRow(r.key,{sku:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.boxNumber} onChange={(e)=>updateRow(r.key,{boxNumber:e.target.value})} className="w-16 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.lengthCm} onChange={(e)=>updateRow(r.key,{lengthCm:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.widthCm} onChange={(e)=>updateRow(r.key,{widthCm:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.heightCm} onChange={(e)=>updateRow(r.key,{heightCm:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.unitWeightKg} onChange={(e)=>updateRow(r.key,{unitWeightKg:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1 text-right">{tw.toFixed(3)}</td><td className="p-1 text-right">{uv.toFixed(4)}</td><td className="p-1 text-right">{tv.toFixed(4)}</td>
                      <td className="p-1"><input value={r.startBoxNo} onChange={(e)=>updateRow(r.key,{startBoxNo:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.endBoxNo} onChange={(e)=>updateRow(r.key,{endBoxNo:e.target.value})} className="w-14 rounded border border-slate-200 px-1 py-1" /></td>
                      <td className="p-1"><input value={r.remark} onChange={(e)=>updateRow(r.key,{remark:e.target.value})} className="w-20 rounded border border-slate-200 px-1 py-1" /></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-600">汇总：{summary.totalBoxes} 箱 / {summary.totalWeight.toFixed(3)} KG / {summary.totalVolume.toFixed(4)} CBM</p>
            {chargePreview ? <p className="mt-2 text-sm">预估费用：<CurrencyAmount value={chargePreview.finalCharge} /></p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCurrent(null)} className="rounded border border-slate-200 px-3 py-1.5 text-sm">取消</button>
              <button type="button" disabled={submitting} onClick={() => { void submitConvert(); }} className="rounded bg-brand px-3 py-1.5 text-sm text-white">{submitting ? "提交中..." : "确认转正式单"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
