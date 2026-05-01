"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackagePlus, Plus, Trash2 } from "lucide-react";

type Warehouse = "YIWU" | "GUANGZHOU" | "SHENZHEN" | "DONGGUAN";
type ShippingMethod = "SEA" | "LAND";
type PreOrderStatus = "PRE_ALERT" | "ARRIVED_FULL" | "SHIPPED";
type ProductCargoType = "GENERAL" | "SENSITIVE" | "INSPECTION";

const WAREHOUSE_OPTIONS: { value: Warehouse; label: string }[] = [
  { value: "YIWU", label: "义乌仓" },
  { value: "GUANGZHOU", label: "广州仓" },
  { value: "SHENZHEN", label: "深圳仓" },
  { value: "DONGGUAN", label: "东莞仓" },
];

const SHIPPING_OPTIONS: { value: ShippingMethod; label: string }[] = [
  { value: "SEA", label: "海运" },
  { value: "LAND", label: "陆运" },
];

const STATUS_OPTIONS: { value: PreOrderStatus; label: string }[] = [
  { value: "PRE_ALERT", label: "已预报" },
  { value: "ARRIVED_FULL", label: "已到齐" },
  { value: "SHIPPED", label: "已发货" },
];

const COUNTRY_OPTIONS: string[] = [
  "泰国",
  "越南",
  "马来西亚",
  "新加坡",
  "菲律宾",
  "印度尼西亚",
  "柬埔寨",
  "其他",
];

type ProductRow = {
  key: string;
  productName: string;
  boxCount: string;
  cargoType: ProductCargoType;
  unitsPerBox: string;
  domesticTracking: string;
  sku: string;
  boxNumber: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

type PreOrderApiJson = {
  message?: string;
  bill?: { trackingNumber: string };
};

/**
 * 生成本地产品行 id。
 */
function newRowId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `r-${String(Date.now())}-${String(Math.random()).slice(2, 8)}`;
}

/**
 * 创建空产品行。
 */
function emptyProductRow(): ProductRow {
  return {
    key: newRowId(),
    productName: "",
    boxCount: "1",
    cargoType: "GENERAL",
    unitsPerBox: "1",
    domesticTracking: "",
    sku: "",
    boxNumber: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
  };
}

/**
 * 将 datetime-local 值格式化为当前时刻默认值。
 */
function defaultDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 安全解析接口 JSON。
 */
async function parsePreOrderResponse(
  response: Response
): Promise<PreOrderApiJson> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      `服务器未返回内容（HTTP ${String(response.status)}）。请检查是否已登录、数据库是否已迁移，或稍后重试。`
    );
  }
  try {
    return JSON.parse(text) as PreOrderApiJson;
  } catch {
    throw new Error(
      `服务器返回了非 JSON 内容（HTTP ${String(response.status)}）。若为 500 页面，请查看服务端日志。`
    );
  }
}

/**
 * 新建货物预报表单（子页）：双列表头 + 可编辑产品明细表。
 */
function CustomerPreOrderNewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const billIdParam = searchParams.get("billId");

  const [warehouse, setWarehouse] = useState<Warehouse>("YIWU");
  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("SEA");
  const [departureDate, setDepartureDate] = useState<string>(
    defaultDatetimeLocal
  );
  const [preOrderStatus, setPreOrderStatus] =
    useState<PreOrderStatus>("PRE_ALERT");
  const [declaredTotalWeight, setDeclaredTotalWeight] = useState<string>("0");
  const [remark, setRemark] = useState<string>("");
  /** 当前登录名，与唛头一致，仅展示 */
  const [loginName, setLoginName] = useState<string>("");
  const [destinationCountry, setDestinationCountry] =
    useState<string>("泰国");
  const [products, setProducts] = useState<ProductRow[]>([emptyProductRow()]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  /**
   * 根据长×宽×高(cm)与箱数汇总预估体积（CBM）。
   */
  const computedVolumeCbm = useMemo((): number => {
    let sum = 0;
    for (const row of products) {
      const l = Number.parseFloat(row.lengthCm);
      const w = Number.parseFloat(row.widthCm);
      const h = Number.parseFloat(row.heightCm);
      const boxes = Number.parseInt(row.boxCount, 10);
      const ok =
        !Number.isNaN(l) &&
        !Number.isNaN(w) &&
        !Number.isNaN(h) &&
        l > 0 &&
        w > 0 &&
        h > 0 &&
        !Number.isNaN(boxes) &&
        boxes >= 0;
      if (!ok) {
        continue;
      }
      const perBoxM3 = (l * w * h) / 1_000_000;
      sum += perBoxM3 * boxes;
    }
    return sum;
  }, [products]);

  /**
   * 总件数 = Σ（箱数 × 每箱产品数）。
   */
  const computedTotalPieces = useMemo((): number => {
    let n = 0;
    for (const row of products) {
      const boxes = Number.parseInt(row.boxCount, 10);
      const upb = Number.parseInt(row.unitsPerBox, 10);
      const b = Number.isNaN(boxes) || boxes < 0 ? 0 : boxes;
      const u = Number.isNaN(upb) || upb < 0 ? 0 : upb;
      n += b * u;
    }
    return n;
  }, [products]);

  /**
   * 拉取登录名，唛头与账号绑定（由服务端写入，前端只读展示）。
   */
  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          user: { username: string } | null;
        };
        setLoginName(data.user?.username ?? "");
      } catch {
        setLoginName("");
      }
    })();
  }, []);

  /**
   * 更新单行产品字段。
   */
  const updateProduct = useCallback(
    (key: string, patch: Partial<ProductRow>): void => {
      setProducts((prev) =>
        prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
      );
    },
    []
  );

  /**
   * 新增产品行。
   */
  const addProductRow = useCallback((): void => {
    setProducts((prev) => [...prev, emptyProductRow()]);
  }, []);

  /**
   * 删除产品行（至少保留一行）。
   */
  const removeProductRow = useCallback((key: string): void => {
    setProducts((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((r) => r.key !== key);
    });
  }, []);

  /**
   * 提交预报单。
   */
  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setError("");

      const tp = computedTotalPieces;
      const tw = Number.parseFloat(declaredTotalWeight.trim());
      const tv = computedVolumeCbm;

      const lines = products.map((row) => ({
        productName: row.productName.trim(),
        boxCount: Number.parseInt(row.boxCount.trim(), 10),
        cargoType: row.cargoType,
        unitsPerBox: Number.parseInt(row.unitsPerBox.trim(), 10),
        domesticTracking: row.domesticTracking.trim() || undefined,
        sku: row.sku.trim() || undefined,
        boxNumber: row.boxNumber.trim() || undefined,
        lengthCm:
          row.lengthCm.trim() === ""
            ? undefined
            : Number.parseFloat(row.lengthCm),
        widthCm:
          row.widthCm.trim() === ""
            ? undefined
            : Number.parseFloat(row.widthCm),
        heightCm:
          row.heightCm.trim() === ""
            ? undefined
            : Number.parseFloat(row.heightCm),
      }));

      setSubmitting(true);
      try {
        const response = await fetch("/api/client/pre-orders", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            warehouse,
            shippingMethod,
            departureDate: departureDate
              ? new Date(departureDate).toISOString()
              : null,
            preOrderStatus,
            remark: remark.trim(),
            destinationCountry: destinationCountry.trim(),
            totalPackages: tp,
            declaredTotalWeight: Number.isNaN(tw) ? 0 : tw,
            declaredTotalVolume: Number.isNaN(tv) ? 0 : tv,
            products: lines,
          }),
        });
        const data = await parsePreOrderResponse(response);
        if (!response.ok) {
          throw new Error(data.message ?? "提交失败");
        }
        router.push("/customer/pre-order?submitted=1");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "提交失败");
      } finally {
        setSubmitting(false);
      }
    },
    [
      warehouse,
      shippingMethod,
      departureDate,
      preOrderStatus,
      remark,
      destinationCountry,
      declaredTotalWeight,
      computedTotalPieces,
      computedVolumeCbm,
      products,
      router,
    ]
  );

  return (
    <main className="mx-auto w-full max-w-[92rem] px-4 py-6 pb-16 sm:px-6 sm:py-8">
      <div className="mb-4">
        <Link
          href="/customer/pre-order"
          className="text-sm font-medium text-[#1677ff] hover:text-[#4096ff]"
        >
          ← 返回运单预报列表
        </Link>
      </div>
      {billIdParam ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          线上暂不支持直接修改已提交预报。如需变更请联系仓库或业务员；您可前往「我的运单」查看详情。
        </p>
      ) : null}
      <div className="mb-6 flex items-center gap-3">
        <PackagePlus className="h-9 w-9 shrink-0 text-brand" aria-hidden />
        <h1 className="text-2xl font-semibold leading-tight text-brand sm:text-3xl">
          新建货物预报
        </h1>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        提交成功后由系统分配预录单号。请如实填写产品与件数信息。
      </p>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">基本信息（左）</h2>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                运输方式
              </span>
              <select
                value={shippingMethod}
                onChange={(e) => {
                  setShippingMethod(e.target.value as ShippingMethod);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
              >
                {SHIPPING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                发货时间
              </span>
              <input
                type="datetime-local"
                value={departureDate}
                onChange={(e) => {
                  setDepartureDate(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                预录单状态
              </span>
              <select
                value={preOrderStatus}
                onChange={(e) => {
                  setPreOrderStatus(e.target.value as PreOrderStatus);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                总重量（KG）
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={declaredTotalWeight}
                onChange={(e) => {
                  setDeclaredTotalWeight(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
              />
            </label>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">目的地与汇总（右）</h2>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                备注
              </span>
              <textarea
                value={remark}
                onChange={(e) => {
                  setRemark(e.target.value);
                }}
                rows={3}
                placeholder="选填"
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand placeholder:text-slate-400 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                唛头（与登录名一致）
              </span>
              <input
                type="text"
                readOnly
                disabled
                value={loginName}
                title="唛头由系统根据登录名自动写入，不可修改"
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                仓库
              </span>
              <select
                value={warehouse}
                onChange={(e) => {
                  setWarehouse(e.target.value as Warehouse);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
              >
                {WAREHOUSE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                目的国家
              </span>
              <select
                value={
                  COUNTRY_OPTIONS.includes(destinationCountry)
                    ? destinationCountry
                    : "其他"
                }
                onChange={(e) => {
                  setDestinationCountry(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand focus:ring-2"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="block rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                总件数（自动）
              </span>
              <p className="font-mono text-sm font-semibold text-slate-900">
                {computedTotalPieces}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                由各行「箱数 × 每箱产品数」汇总
              </p>
            </div>
            <div className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="mb-1 block text-xs font-medium text-slate-700">
                预估总体积（自动，CBM）
              </span>
              <p className="font-mono text-sm font-semibold text-slate-900">
                {computedVolumeCbm.toFixed(4)}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Σ（长×宽×高÷10⁶×箱数），单位立方米
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              预录单产品
            </h2>
            <button
              type="button"
              onClick={addProductRow}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              新增
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[960px] w-full border-collapse text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="sticky left-0 z-[1] border-b border-slate-200 bg-slate-50 px-2 py-2 font-medium">
                    #
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    产品名称 <span className="text-red-500">*</span>
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    箱数 <span className="text-red-500">*</span>
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    类型
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    每箱产品数 <span className="text-red-500">*</span>
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    国内单号
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    SKU
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    箱号
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    长(cm)
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    宽(cm)
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    高(cm)
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((row, index) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="sticky left-0 bg-white px-2 py-1.5 text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.productName}
                        onChange={(e) => {
                          updateProduct(row.key, {
                            productName: e.target.value,
                          });
                        }}
                        className="w-full min-w-[7rem] rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min={1}
                        value={row.boxCount}
                        onChange={(e) => {
                          updateProduct(row.key, { boxCount: e.target.value });
                        }}
                        className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={row.cargoType}
                        onChange={(e) => {
                          updateProduct(row.key, {
                            cargoType: e.target.value as ProductCargoType,
                          });
                        }}
                        className="w-full min-w-[5rem] rounded border border-slate-200 bg-white px-1 py-1 text-xs sm:text-sm"
                      >
                        <option value="GENERAL">普货</option>
                        <option value="SENSITIVE">敏感货</option>
                        <option value="INSPECTION">商检货</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min={1}
                        value={row.unitsPerBox}
                        onChange={(e) => {
                          updateProduct(row.key, {
                            unitsPerBox: e.target.value,
                          });
                        }}
                        className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.domesticTracking}
                        onChange={(e) => {
                          updateProduct(row.key, {
                            domesticTracking: e.target.value,
                          });
                        }}
                        className="w-full min-w-[5rem] rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.sku}
                        onChange={(e) => {
                          updateProduct(row.key, { sku: e.target.value });
                        }}
                        className="w-full min-w-[4rem] rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.boxNumber}
                        onChange={(e) => {
                          updateProduct(row.key, { boxNumber: e.target.value });
                        }}
                        className="w-full min-w-[4rem] rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.lengthCm}
                        onChange={(e) => {
                          updateProduct(row.key, { lengthCm: e.target.value });
                        }}
                        className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.widthCm}
                        onChange={(e) => {
                          updateProduct(row.key, { widthCm: e.target.value });
                        }}
                        className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.heightCm}
                        onChange={(e) => {
                          updateProduct(row.key, { heightCm: e.target.value });
                        }}
                        className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs sm:text-sm"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        disabled={products.length <= 1}
                        onClick={() => {
                          removeProductRow(row.key);
                        }}
                        className="inline-flex rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        aria-label="删除行"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "提交中…" : "提交预报"}
        </button>
      </form>
    </main>
  );
}

/**
 * useSearchParams 需 Suspense 包裹（Next.js 要求）。
 */
export default function CustomerPreOrderNewPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[92rem] px-4 py-16 text-center text-sm text-slate-500">
          加载表单…
        </div>
      }
    >
      <CustomerPreOrderNewForm />
    </Suspense>
  );
}
