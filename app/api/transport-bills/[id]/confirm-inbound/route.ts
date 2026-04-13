import { NextResponse } from "next/server";
import { type ProductCargoType, type ShippingMethod } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateCharge,
  isUniqueConstraintError,
  issueWarehouseBillTrackingNumberWithTransaction,
} from "@/lib/core/billing";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type ConfirmInboundProduct = {
  productName?: string;
  boxCount?: number;
  cargoType?: ProductCargoType;
  unitsPerBox?: number;
  domesticTracking?: string;
  inboundTracking?: string;
  sku?: string;
  boxNumber?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  unitWeightKg?: number;
  startBoxNo?: number;
  endBoxNo?: number;
  remark?: string;
};

type ConfirmInboundBody = {
  shippingMethod?: ShippingMethod;
  unitPrice?: number;
  isMinChargeWaived?: boolean;
  products?: ConfirmInboundProduct[];
};

const VALID_SHIPPING_METHODS: ShippingMethod[] = ["SEA", "LAND"];
const VALID_CARGO: ProductCargoType[] = ["GENERAL", "SENSITIVE", "INSPECTION"];

/**
 * 将可选字符串裁剪为空字符串。
 */
function cleanText(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * 将可选非负数字标准化；非法值返回 0。
 */
function toNonNegativeNumber(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return value;
}

/**
 * 校验确认入库入参，并确保至少一条有效产品行。
 */
function validateConfirmBody(body: ConfirmInboundBody): string | null {
  if (!body.shippingMethod || !VALID_SHIPPING_METHODS.includes(body.shippingMethod)) {
    return "运输方式参数无效";
  }
  if (typeof body.unitPrice !== "number" || Number.isNaN(body.unitPrice) || body.unitPrice < 0) {
    return "单价必须是大于等于 0 的数字";
  }
  const products = body.products ?? [];
  if (products.length < 1) {
    return "请至少填写一行产品明细";
  }
  for (let i = 0; i < products.length; i += 1) {
    const p = products[i] as ConfirmInboundProduct;
    if (!cleanText(p.productName)) {
      return `第 ${i + 1} 行：请填写产品名称`;
    }
    if (!Number.isInteger(p.boxCount) || (p.boxCount ?? 0) < 1) {
      return `第 ${i + 1} 行：箱数须为不小于 1 的整数`;
    }
    if (!Number.isInteger(p.unitsPerBox) || (p.unitsPerBox ?? 0) < 1) {
      return `第 ${i + 1} 行：每箱产品数须为不小于 1 的整数`;
    }
    if (p.cargoType && !VALID_CARGO.includes(p.cargoType)) {
      return `第 ${i + 1} 行：产品类型无效`;
    }
  }
  return null;
}

/**
 * 计算产品行汇总：总重量、总体积、总箱数、摘要货名与运单级国内单号。
 */
function summarizeProducts(products: ConfirmInboundProduct[]): {
  totalWeight: number;
  totalVolume: number;
  totalBoxes: number;
  goodsName: string;
  domesticTracking: string | null;
  normalizedProducts: Array<{
    productName: string;
    boxCount: number;
    cargoType: ProductCargoType;
    unitsPerBox: number;
    domesticTracking: string | null;
    inboundTracking: string | null;
    sku: string | null;
    boxNumber: string | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    unitWeightKg: number | null;
    totalWeightKg: number;
    unitVolumeCbm: number;
    totalVolumeCbm: number;
    startBoxNo: number | null;
    endBoxNo: number | null;
    remark: string | null;
  }>;
} {
  let totalWeight = 0;
  let totalVolume = 0;
  let totalBoxes = 0;
  let domesticTracking: string | null = null;

  const normalizedProducts = products.map((p) => {
    const boxCount = p.boxCount as number;
    const unitsPerBox = p.unitsPerBox as number;
    const cargoType = p.cargoType && VALID_CARGO.includes(p.cargoType) ? p.cargoType : "GENERAL";
    const lengthCm = toNonNegativeNumber(p.lengthCm);
    const widthCm = toNonNegativeNumber(p.widthCm);
    const heightCm = toNonNegativeNumber(p.heightCm);
    const unitWeightKg = toNonNegativeNumber(p.unitWeightKg);

    const unitVolumeCbm =
      lengthCm > 0 && widthCm > 0 && heightCm > 0
        ? (lengthCm * widthCm * heightCm) / 1_000_000
        : 0;
    const totalWeightKg = unitWeightKg * boxCount;
    const totalVolumeCbm = unitVolumeCbm * boxCount;

    totalBoxes += boxCount;
    totalWeight += totalWeightKg;
    totalVolume += totalVolumeCbm;

    const rowDomestic = cleanText(p.domesticTracking);
    if (!domesticTracking && rowDomestic) {
      domesticTracking = rowDomestic;
    }

    const startBoxNo = Number.isInteger(p.startBoxNo) ? (p.startBoxNo as number) : null;
    const endBoxNo = Number.isInteger(p.endBoxNo) ? (p.endBoxNo as number) : null;

    return {
      productName: cleanText(p.productName),
      boxCount,
      cargoType,
      unitsPerBox,
      domesticTracking: rowDomestic || null,
      inboundTracking: cleanText(p.inboundTracking) || null,
      sku: cleanText(p.sku) || null,
      boxNumber: cleanText(p.boxNumber) || null,
      lengthCm: lengthCm > 0 ? lengthCm : null,
      widthCm: widthCm > 0 ? widthCm : null,
      heightCm: heightCm > 0 ? heightCm : null,
      unitWeightKg: unitWeightKg > 0 ? unitWeightKg : null,
      totalWeightKg,
      unitVolumeCbm,
      totalVolumeCbm,
      startBoxNo,
      endBoxNo,
      remark: cleanText(p.remark) || null,
    };
  });

  const names = normalizedProducts.map((p) => p.productName).filter(Boolean);
  const joined = names.slice(0, 5).join("、");
  const goodsName = names.length > 5 ? `${joined} 等` : joined;

  return {
    totalWeight,
    totalVolume,
    totalBoxes,
    goodsName,
    domesticTracking,
    normalizedProducts,
  };
}

/**
 * 将待入库预报单转为正式运单：员工可录入多行明细并自动计算重量/体积计费。
 */
export async function PATCH(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const gate = await requireStaffOrAdmin();
  if (gate instanceof NextResponse) {
    return gate;
  }

  const { id } = await context.params;
  const body = (await request.json()) as ConfirmInboundBody;
  const error = validateConfirmBody(body);
  if (error) {
    return NextResponse.json({ message: error }, { status: 400 });
  }

  const existing = await prisma.transportBill.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ message: "运单不存在" }, { status: 404 });
  }

  if (!existing.isForecastPending) {
    return NextResponse.json(
      { message: "该单已入库或非预报单，无法重复确认" },
      { status: 400 }
    );
  }

  const shippingMethod = body.shippingMethod as ShippingMethod;
  const unitPrice = body.unitPrice as number;
  const isMinChargeWaived = Boolean(body.isMinChargeWaived);
  const summary = summarizeProducts(body.products as ConfirmInboundProduct[]);
  const preferredFormalNo = existing.trackingNumber.startsWith("YB")
    ? existing.trackingNumber.slice(2)
    : existing.trackingNumber;

  let bill;
  try {
    bill = await prisma.$transaction(async (tx) => {
      const updated = await tx.transportBill.update({
        where: { id },
        data: {
          trackingNumber: preferredFormalNo,
          isForecastPending: false,
          shipmentStatus: "INBOUND_CONFIRMED",
          shippingMethod,
          actualCBM: summary.totalVolume,
          actualWeight: summary.totalWeight,
          unitPrice,
          isMinChargeWaived,
          totalPackages: summary.totalBoxes,
          declaredTotalWeight: summary.totalWeight,
          declaredTotalVolume: summary.totalVolume,
          goodsName: summary.goodsName || existing.goodsName,
          domesticTracking: summary.domesticTracking,
          billProducts: {
            deleteMany: {},
            create: summary.normalizedProducts.map((p, idx) => ({
              productName: p.productName,
              boxCount: p.boxCount,
              cargoType: p.cargoType,
              unitsPerBox: p.unitsPerBox,
              domesticTracking: p.domesticTracking,
              inboundTracking: p.inboundTracking,
              sku: p.sku,
              boxNumber: p.boxNumber,
              lengthCm: p.lengthCm,
              widthCm: p.widthCm,
              heightCm: p.heightCm,
              unitWeightKg: p.unitWeightKg,
              totalWeightKg: p.totalWeightKg,
              unitVolumeCbm: p.unitVolumeCbm,
              totalVolumeCbm: p.totalVolumeCbm,
              startBoxNo: p.startBoxNo,
              endBoxNo: p.endBoxNo,
              remark: p.remark,
              sortOrder: idx,
            })),
          },
        },
      });
      return updated;
    });
  } catch (errorWithPreferred) {
    if (!isUniqueConstraintError(errorWithPreferred)) {
      throw errorWithPreferred;
    }
    bill = await issueWarehouseBillTrackingNumberWithTransaction(
      prisma,
      existing.warehouse,
      new Date(),
      async (tx, trackingNumber) =>
        tx.transportBill.update({
          where: { id },
          data: {
            trackingNumber,
            isForecastPending: false,
            shipmentStatus: "INBOUND_CONFIRMED",
            shippingMethod,
            actualCBM: summary.totalVolume,
            actualWeight: summary.totalWeight,
            unitPrice,
            isMinChargeWaived,
            totalPackages: summary.totalBoxes,
            declaredTotalWeight: summary.totalWeight,
            declaredTotalVolume: summary.totalVolume,
            goodsName: summary.goodsName || existing.goodsName,
            domesticTracking: summary.domesticTracking,
            billProducts: {
              deleteMany: {},
              create: summary.normalizedProducts.map((p, idx) => ({
                productName: p.productName,
                boxCount: p.boxCount,
                cargoType: p.cargoType,
                unitsPerBox: p.unitsPerBox,
                domesticTracking: p.domesticTracking,
                inboundTracking: p.inboundTracking,
                sku: p.sku,
                boxNumber: p.boxNumber,
                lengthCm: p.lengthCm,
                widthCm: p.widthCm,
                heightCm: p.heightCm,
                unitWeightKg: p.unitWeightKg,
                totalWeightKg: p.totalWeightKg,
                unitVolumeCbm: p.unitVolumeCbm,
                totalVolumeCbm: p.totalVolumeCbm,
                startBoxNo: p.startBoxNo,
                endBoxNo: p.endBoxNo,
                remark: p.remark,
                sortOrder: idx,
              })),
            },
          },
        })
    );
  }

  const charge = calculateCharge({
    shippingMethod: bill.shippingMethod,
    actualCBM: bill.actualCBM,
    unitPrice: bill.unitPrice,
    isMinChargeWaived: bill.isMinChargeWaived,
  });

  return NextResponse.json({
    message: "已确认入库并转正式运单",
    bill,
    charge,
    hasMinCompensation:
      !bill.isMinChargeWaived && charge.minChargeDifferenceFee > 0,
  });
}
