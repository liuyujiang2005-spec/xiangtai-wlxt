"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Package } from "lucide-react";
import type { TimelineStep } from "@/lib/customer/build-shipment-timeline";
import { formatCny } from "@/lib/customer/shipment-display";

type BillProduct = {
  id: string;
  productName: string;
  boxCount: number;
  cargoType: string;
  sku: string | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};

type DetailResponse = {
  bill: {
    id: string;
    trackingNumber: string;
    warehouse: string;
    shippingMethod: string;
    destinationCountry: string;
    remark: string | null;
    isForecastPending: boolean;
    totalPackages: number | null;
    declaredTotalVolume: number | null;
    createdAt: string;
    billProducts: BillProduct[];
  };
  markDisplay: string;
  statusLabel: string;
  pendingAmount: number;
  timeline: TimelineStep[];
};

const WAREHOUSE_LABEL: Record<string, string> = {
  YIWU: "义乌仓",
  GUANGZHOU: "广州仓",
  SHENZHEN: "深圳仓",
  DONGGUAN: "东莞仓",
};

const METHOD_LABEL: Record<string, string> = {
  SEA: "海运",
  LAND: "陆运",
};

const CARGO_LABEL: Record<string, string> = {
  GENERAL: "普货",
  SENSITIVE: "敏感货",
  INSPECTION: "商检货",
};

/**
 * 运单详情页：费用摘要 + 垂直时间轴 + 产品明细。
 */
export default function CustomerShipmentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void props.params.then((p) => {
      setId(p.id);
    });
  }, [props.params]);

  /**
   * 拉取详情与时间轴。
   */
  const load = useCallback(async (billId: string): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/client/shipments/${billId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const j = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(j.message ?? "加载失败");
      }
      const json = (await response.json()) as DetailResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      void load(id);
    }
  }, [id, load]);

  if (!id || loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] px-4 py-8 text-sm text-slate-500">
        加载中…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] px-4 py-8">
        <p className="text-sm text-red-600">{error || "未找到运单"}</p>
        <Link
          href="/customer/shipments"
          className="mt-4 inline-flex items-center gap-1 text-sm text-[#1677ff]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>
    );
  }

  const { bill, markDisplay, statusLabel, pendingAmount, timeline } = data;

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-12">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link
          href="/customer/shipments"
          className="mb-4 inline-flex items-center gap-1 text-xs text-[#1677ff] hover:text-[#4096ff]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回我的运单
        </Link>

        <div className="rounded-lg border border-[#d9d9d9] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f0f0] pb-3">
            <div>
              <h1 className="text-base font-semibold text-[rgba(0,0,0,0.88)]">
                运单详情
              </h1>
              <p className="mt-1 font-mono text-sm text-[#1677ff]">
                {bill.trackingNumber}
              </p>
              <p className="mt-1 text-xs text-[rgba(0,0,0,0.45)]">
                唛头：<span className="font-mono font-medium text-slate-800">{markDisplay}</span>
                {" · "}
                状态：{statusLabel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[rgba(0,0,0,0.45)]">待支付金额</p>
              <p className="text-lg font-semibold tabular-nums text-[rgba(0,0,0,0.88)]">
                {formatCny(pendingAmount)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <p>
              <span className="text-[rgba(0,0,0,0.45)]">仓库：</span>
              {WAREHOUSE_LABEL[bill.warehouse] ?? bill.warehouse}
            </p>
            <p>
              <span className="text-[rgba(0,0,0,0.45)]">运输方式：</span>
              {METHOD_LABEL[bill.shippingMethod] ?? bill.shippingMethod}
            </p>
            <p>
              <span className="text-[rgba(0,0,0,0.45)]">目的国家：</span>
              {(bill.destinationCountry ?? "").trim() || "泰国"}
            </p>
            <p>
              <span className="text-[rgba(0,0,0,0.45)]">总件数：</span>
              {bill.totalPackages ?? "—"}
            </p>
            <p className="sm:col-span-2">
              <span className="text-[rgba(0,0,0,0.45)]">预报体积：</span>
              {(bill.declaredTotalVolume ?? 0).toFixed(4)} CBM
            </p>
            {bill.remark ? (
              <p className="sm:col-span-2">
                <span className="text-[rgba(0,0,0,0.45)]">备注：</span>
                {bill.remark}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[#d9d9d9] bg-white p-4 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[rgba(0,0,0,0.88)]">
            <Package className="h-4 w-4 text-[#1677ff]" />
            物流进度
          </h2>
          <ol className="relative border-l border-[#f0f0f0] pl-6">
            {timeline.map((step, index) => (
              <li key={index} className="mb-6 last:mb-0">
                <span
                  className={`absolute -left-[9px] mt-1.5 h-3 w-3 rounded-full border-2 ${
                    step.done
                      ? step.current
                        ? "border-[#1677ff] bg-[#e6f4ff]"
                        : "border-[#52c41a] bg-white"
                      : "border-[#d9d9d9] bg-white"
                  }`}
                />
                <p className="text-sm font-medium text-[rgba(0,0,0,0.88)]">
                  {step.title}
                  {step.current ? (
                    <span className="ml-2 rounded bg-[#e6f4ff] px-1.5 py-0.5 text-[10px] font-normal text-[#1677ff]">
                      当前
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-[rgba(0,0,0,0.45)]">
                  {step.description}
                </p>
                {step.at ? (
                  <p className="mt-1 font-mono text-[10px] text-[rgba(0,0,0,0.35)]">
                    {new Date(step.at).toLocaleString("zh-CN", {
                      hour12: false,
                    })}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-4 rounded-lg border border-[#d9d9d9] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[rgba(0,0,0,0.88)]">
            产品明细
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-[rgba(0,0,0,0.45)]">
                  <th className="px-2 py-1 font-medium">品名</th>
                  <th className="px-2 py-1 font-medium">箱数</th>
                  <th className="px-2 py-1 font-medium">类型</th>
                  <th className="px-2 py-1 font-medium">SKU</th>
                  <th className="px-2 py-1 font-medium">尺寸(cm)</th>
                </tr>
              </thead>
              <tbody>
                {bill.billProducts.map((p) => (
                  <tr key={p.id} className="border-b border-[#f0f0f0]">
                    <td className="px-2 py-1">{p.productName}</td>
                    <td className="px-2 py-1 tabular-nums">{p.boxCount}</td>
                    <td className="px-2 py-1">
                      {CARGO_LABEL[p.cargoType] ?? p.cargoType}
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px]">
                      {p.sku ?? "—"}
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px]">
                      {p.lengthCm != null &&
                      p.widthCm != null &&
                      p.heightCm != null
                        ? `${p.lengthCm}×${p.widthCm}×${p.heightCm}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/customer/waybill/${encodeURIComponent(bill.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded border border-[#1677ff] bg-[#1677ff] px-4 py-2 text-xs font-medium text-white hover:bg-[#4096ff]"
          >
            打开面单
          </Link>
        </div>
      </div>
    </div>
  );
}
