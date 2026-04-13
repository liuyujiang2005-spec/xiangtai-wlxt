import { NextResponse } from "next/server";
import type {
  PreOrderStatus,
  ProductCargoType,
  ShippingMethod,
  Warehouse,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateCharge,
  issuePreOrderTrackingNumberWithTransaction,
} from "@/lib/core/billing";
import { requireClient } from "@/lib/auth/require-client";

type IncomingProduct = {
  productName?: string;
  boxCount?: number;
  cargoType?: string;
  unitsPerBox?: number;
  domesticTracking?: string;
  sku?: string;
  boxNumber?: string;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

type CreatePreOrderBody = {
  warehouse?: Warehouse;
  shippingMethod?: ShippingMethod;
  departureDate?: string | null;
  preOrderStatus?: string;
  remark?: string;
  destinationCountry?: string;
  totalPackages?: number;
  declaredTotalWeight?: number;
  declaredTotalVolume?: number;
  products?: IncomingProduct[];
};

const VALID_WAREHOUSES: Warehouse[] = [
  "YIWU",
  "GUANGZHOU",
  "SHENZHEN",
  "DONGGUAN",
];
const VALID_SHIPPING: ShippingMethod[] = ["SEA", "LAND"];
const VALID_PRE_STATUS: PreOrderStatus[] = [
  "PRE_ALERT",
  "ARRIVED_FULL",
  "SHIPPED",
];
const VALID_CARGO: ProductCargoType[] = [
  "GENERAL",
  "SENSITIVE",
  "INSPECTION",
];

/**
 * 解析预录单状态。
 */
function parsePreOrderStatus(value: string | undefined): PreOrderStatus | null {
  if (!value) {
    return "PRE_ALERT";
  }
  return VALID_PRE_STATUS.includes(value as PreOrderStatus)
    ? (value as PreOrderStatus)
    : null;
}

/**
 * 解析产品类型。
 */
function parseCargoType(value: string | undefined): ProductCargoType {
  if (value === "SENSITIVE") {
    return "SENSITIVE";
  }
  if (value === "INSPECTION") {
    return "INSPECTION";
  }
  return "GENERAL";
}

/**
 * 将摘要货名从多行产品拼接（便于旧字段兼容）。
 */
function buildGoodsNameSummary(products: IncomingProduct[]): string {
  const names = products
    .map((p) => (p.productName ?? "").trim())
    .filter(Boolean);
  if (names.length === 0) {
    return "";
  }
  const joined = names.slice(0, 5).join("、");
  return names.length > 5 ? `${joined} 等` : joined;
}

/**
 * 取首条非空国内单号作为运单级兼容字段。
 */
function pickPrimaryDomestic(products: IncomingProduct[]): string {
  for (const p of products) {
    const t = (p.domesticTracking ?? "").trim();
    if (t) {
      return t;
    }
  }
  return "";
}

/**
 * 校验预报单与产品行。
 */
function validatePreOrderBody(body: CreatePreOrderBody): string | null {
  if (!body.warehouse || !VALID_WAREHOUSES.includes(body.warehouse)) {
    return "请选择有效仓库";
  }
  if (!body.shippingMethod || !VALID_SHIPPING.includes(body.shippingMethod)) {
    return "请选择有效运输方式";
  }
  const status = parsePreOrderStatus(body.preOrderStatus);
  if (!status) {
    return "预录单状态无效";
  }
  const dest = (body.destinationCountry ?? "").trim();
  if (!dest) {
    return "请填写或选择目的国家";
  }
  if (
    typeof body.totalPackages !== "number" ||
    Number.isNaN(body.totalPackages) ||
    body.totalPackages < 0
  ) {
    return "总件数须为非负数字";
  }
  if (
    typeof body.declaredTotalWeight !== "number" ||
    Number.isNaN(body.declaredTotalWeight) ||
    body.declaredTotalWeight < 0
  ) {
    return "总重量须为非负数字";
  }
  if (
    typeof body.declaredTotalVolume !== "number" ||
    Number.isNaN(body.declaredTotalVolume) ||
    body.declaredTotalVolume < 0
  ) {
    return "总体积须为非负数字";
  }
  const products = body.products ?? [];
  if (products.length < 1) {
    return "请至少添加一行产品明细";
  }
  for (let i = 0; i < products.length; i += 1) {
    const p = products[i];
    const name = (p.productName ?? "").trim();
    if (!name) {
      return `第 ${i + 1} 行：请填写产品名称`;
    }
    if (
      typeof p.boxCount !== "number" ||
      Number.isNaN(p.boxCount) ||
      p.boxCount < 1 ||
      !Number.isInteger(p.boxCount)
    ) {
      return `第 ${i + 1} 行：箱数须为不小于 1 的整数`;
    }
    if (
      typeof p.unitsPerBox !== "number" ||
      Number.isNaN(p.unitsPerBox) ||
      p.unitsPerBox < 1 ||
      !Number.isInteger(p.unitsPerBox)
    ) {
      return `第 ${i + 1} 行：每箱产品数须为不小于 1 的整数`;
    }
    if (p.cargoType && !VALID_CARGO.includes(p.cargoType as ProductCargoType)) {
      return `第 ${i + 1} 行：产品类型无效`;
    }
  }
  return null;
}

/**
 * 解析可选尺寸为实数或 undefined。
 */
function parseDim(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return undefined;
  }
  if (value < 0) {
    return undefined;
  }
  return value;
}

/**
 * 客户提交预报单：YB 单号仅服务端在事务内生成（忽略请求体中的 trackingNumber），与 BillProduct 同事务写入。
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireClient();
    if (auth instanceof NextResponse) {
      return auth;
    }

    let body: CreatePreOrderBody;
    try {
      const raw = (await request.json()) as CreatePreOrderBody & {
        trackingNumber?: unknown;
      };
      if ("trackingNumber" in raw) {
        Reflect.deleteProperty(raw, "trackingNumber");
      }
      body = raw;
    } catch {
      return NextResponse.json({ message: "请求体格式错误" }, { status: 400 });
    }

    const error = validatePreOrderBody(body);
    if (error) {
      return NextResponse.json({ message: error }, { status: 400 });
    }

    const warehouse = body.warehouse as Warehouse;
    const shippingMethod = body.shippingMethod as ShippingMethod;
    const preOrderStatus = parsePreOrderStatus(body.preOrderStatus) as PreOrderStatus;
    const remark = (body.remark ?? "").trim() || null;
    const destinationCountry = (body.destinationCountry ?? "").trim();
    const totalPackages = body.totalPackages as number;
    const declaredTotalWeight = body.declaredTotalWeight as number;
    const declaredTotalVolume = body.declaredTotalVolume as number;
    const products = body.products as IncomingProduct[];

    let departureDate: Date | null = null;
    if (body.departureDate) {
      const d = new Date(body.departureDate);
      if (!Number.isNaN(d.getTime())) {
        departureDate = d;
      }
    }

    const goodsName = buildGoodsNameSummary(products);
    const domesticTracking = pickPrimaryDomestic(products);
    const issueDate = new Date();

    const bill = await issuePreOrderTrackingNumberWithTransaction(
      prisma,
      warehouse,
      issueDate,
      async (tx, trackingNumber) =>
        tx.transportBill.create({
          data: {
            trackingNumber,
            warehouse,
            shippingMethod,
            actualCBM: declaredTotalVolume,
            actualWeight: declaredTotalWeight,
            unitPrice: 0,
            isMinChargeWaived: false,
            domesticTracking: domesticTracking || null,
            goodsName: goodsName || null,
            estimatedPieces: totalPackages,
            clientUserId: auth.sub,
            destinationCountry,
            departureDate,
            preOrderStatus,
            remark,
            shippingMark: auth.username,
            totalPackages,
            declaredTotalWeight,
            declaredTotalVolume,
            billProducts: {
              create: products.map((p, index) => ({
                productName: (p.productName ?? "").trim(),
                boxCount: p.boxCount as number,
                cargoType: parseCargoType(p.cargoType),
                unitsPerBox: p.unitsPerBox as number,
                domesticTracking: (p.domesticTracking ?? "").trim() || null,
                sku: (p.sku ?? "").trim() || null,
                boxNumber: (p.boxNumber ?? "").trim() || null,
                lengthCm: parseDim(p.lengthCm ?? undefined),
                widthCm: parseDim(p.widthCm ?? undefined),
                heightCm: parseDim(p.heightCm ?? undefined),
                sortOrder: index,
              })),
            },
          },
          include: {
            billProducts: true,
          },
        })
    );

    const charge = calculateCharge({
      shippingMethod: bill.shippingMethod,
      actualCBM: bill.actualCBM,
      unitPrice: bill.unitPrice,
      isMinChargeWaived: bill.isMinChargeWaived,
    });

    return NextResponse.json({
      message: "预报单已提交",
      bill: {
        ...bill,
        charge,
        hasMinCompensation: false,
      },
    });
  } catch (err) {
    console.error("[api/client/pre-orders]", err);
    const message =
      err instanceof Error ? err.message : "创建预报单失败，请稍后重试";
    return NextResponse.json({ message }, { status: 500 });
  }
}
