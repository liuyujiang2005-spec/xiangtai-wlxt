"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardPenLine, PackageCheck } from "lucide-react";
import { CurrencyAmount } from "@/app/components/CurrencyAmount";

type Warehouse = "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
type ShippingMethod = "SEA" | "LAND";

type CreateResult = {
  message: string;
  bill: {
    trackingNumber: string;
  };
  charge: {
    actualFee: number;
    minChargeDifferenceFee: number;
    finalCharge: number;
  };
};

const WAREHOUSE_OPTIONS: Array<{ value: Warehouse; label: string }> = [
  { value: "YIWU", label: "义乌仓" },
  { value: "GUANGZHOU", label: "广州仓" },
  { value: "SHENZHEN", label: "深圳仓" },
  { value: "DONGGUAN", label: "东莞仓" },
];

const SHIPPING_OPTIONS: Array<{ value: ShippingMethod; label: string }> = [
  { value: "SEA", label: "海运" },
  { value: "LAND", label: "陆运" },
];

const MIN_CBM: Record<ShippingMethod, number> = {
  SEA: 0.5,
  LAND: 0.3,
};

/**
 * 根据当前表单状态本地预估应付金额（与后端 calculateCharge 规则一致，仅用于界面展示）。
 */
function previewFinalCharge(
  shippingMethod: ShippingMethod,
  actualCBM: number,
  unitPrice: number,
  isMinChargeWaived: boolean
): { finalCharge: number; minChargeApplies: boolean } {
  if (isMinChargeWaived) {
    return { finalCharge: actualCBM * unitPrice, minChargeApplies: false };
  }
  const min = MIN_CBM[shippingMethod];
  const chargeable = Math.max(actualCBM, min);
  return {
    finalCharge: chargeable * unitPrice,
    minChargeApplies: chargeable > actualCBM,
  };
}

/**
 * 新运单录入页面：费用预估与数据库提交（单号在保存时由服务端生成）。
 */
export default function NewTransportBillPage() {
  const [warehouse, setWarehouse] = useState<Warehouse>("YIWU");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("SEA");
  const [actualCBM, setActualCBM] = useState<string>("");
  const [actualWeight, setActualWeight] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [isMinChargeWaived, setIsMinChargeWaived] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [result, setResult] = useState<CreateResult | null>(null);

  /**
   * 表单是否可提交，用于按钮禁用状态控制。
   */
  const canSubmit = useMemo(() => {
    return actualCBM !== "" && actualWeight !== "" && unitPrice !== "";
  }, [actualCBM, actualWeight, unitPrice]);

  /**
   * 根据已填体积与单价计算界面上的应付预览。
   */
  const chargePreview = useMemo(() => {
    const cbm = Number(actualCBM);
    const price = Number(unitPrice);
    if (
      actualCBM === "" ||
      unitPrice === "" ||
      Number.isNaN(cbm) ||
      Number.isNaN(price) ||
      cbm < 0 ||
      price < 0
    ) {
      return null;
    }
    return previewFinalCharge(shippingMethod, cbm, price, isMinChargeWaived);
  }, [actualCBM, unitPrice, shippingMethod, isMinChargeWaived]);

  /**
   * 提交新运单到后端并写入数据库。
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/transport-bills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          warehouse,
          shippingMethod,
          actualCBM: Number(actualCBM),
          actualWeight: Number(actualWeight),
          unitPrice: Number(unitPrice),
          isMinChargeWaived,
        }),
      });

      const data = (await response.json()) as CreateResult | { message: string };

      if (response.status === 401) {
        throw new Error("请先登录（需管理员或员工账号）后再提交运单。");
      }
      if (response.status === 403) {
        throw new Error("当前账号无权录单，请使用管理员或员工账号。");
      }
      if (!response.ok) {
        throw new Error("message" in data ? data.message : "运单提交失败");
      }

      setResult(data as CreateResult);
      setActualCBM("");
      setActualWeight("");
      setUnitPrice("");
      setIsMinChargeWaived(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "提交失败，请稍后重试。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-white px-4 py-6 text-slate-900 sm:px-6">
      <header className="mb-5 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand/10 p-2">
            <ClipboardPenLine className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-brand">新运单录入</h1>
            <p className="text-sm text-slate-500">湘泰物流 · 快速录单</p>
          </div>
        </div>
      </header>

      {chargePreview ? (
        <section className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">预估应付（人民币）</p>
          <p className="mt-1 text-xl text-brand">
            <CurrencyAmount value={chargePreview.finalCharge} className="text-brand" />
          </p>
          {isMinChargeWaived ? (
            <p className="mt-1 text-xs text-emerald-700">已勾选豁免低消，按实际体积计费</p>
          ) : chargePreview.minChargeApplies ? (
            <p className="mt-1 text-xs text-amber-700">
              已按低消标准 {MIN_CBM[shippingMethod]} CBM 计费（海运 0.5 / 陆运 0.3）
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">按实际体积计费，未触发低消</p>
          )}
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">仓库</span>
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
            value={warehouse}
            onChange={(event) => setWarehouse(event.target.value as Warehouse)}
          >
            {WAREHOUSE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">运输方式</span>
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
            value={shippingMethod}
            onChange={(event) =>
              setShippingMethod(event.target.value as ShippingMethod)
            }
          >
            {SHIPPING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">实际体积 (CBM)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
            value={actualCBM}
            onChange={(event) => setActualCBM(event.target.value)}
            placeholder="例如 0.42"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">实际重量 (KG)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
            value={actualWeight}
            onChange={(event) => setActualWeight(event.target.value)}
            placeholder="例如 128.5"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">单价</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            placeholder="例如 580"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={isMinChargeWaived}
            onChange={(event) => setIsMinChargeWaived(event.target.checked)}
          />
          <span className="text-slate-700">豁免低消（管理员开启后按实际体积 × 单价，不计低消）</span>
        </label>

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <PackageCheck className="h-4 w-4" />
          {submitting ? "提交中..." : "保存运单"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link
          href="/transport-bills"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          前往运单管理列表
        </Link>
      </p>

      {errorMessage ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      {result ? (
        <section className="mt-4 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-medium text-slate-700">提交成功</h2>
          <p className="mt-2 text-sm text-slate-600">
            单号：<span className="font-semibold text-brand">{result.bill.trackingNumber}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-600">
            实际费：
            <CurrencyAmount value={result.charge.actualFee} />
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-600">
            低消补差费：
            <CurrencyAmount value={result.charge.minChargeDifferenceFee} />
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-800">
            最终总费：
            <CurrencyAmount value={result.charge.finalCharge} className="text-brand" />
          </p>
        </section>
      ) : null}
    </main>
  );
}
