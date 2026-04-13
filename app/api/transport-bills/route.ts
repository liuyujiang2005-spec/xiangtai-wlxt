import { NextResponse } from "next/server";
import {
  type ProductCargoType,
  type ShippingMethod,
  type Warehouse,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateCharge,
  issueWarehouseBillTrackingNumberWithTransaction,
} from "@/lib/core/billing";
import { requireStaffOrAdmin } from "@/lib/auth/require-staff-or-admin";

type CreateProduct = {
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

type CreateTransportBillBody = {
  warehouse?: Warehouse;
  shippingMethod?: ShippingMethod;
  actualCBM?: number;
  actualWeight?: number;
  unitPrice?: number;
  isMinChargeWaived?: boolean;
  clientUserId?: string;
  products?: CreateProduct[];
};

type BillProductCreateInput = {
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
  sortOrder: number;
};

const VALID_WAREHOUSES: Warehouse[] = [
  "YIWU",
  "GUANGZHOU",
  "SHENZHEN",
  "DONGGUAN",
];
const VALID_SHIPPING_METHODS: ShippingMethod[] = ["SEA", "LAND"];
const VALID_CARGO: ProductCargoType[] = ["GENERAL", "SENSITIVE", "INSPECTION"];

/**
 * 获取并清洗搜索关键词，避免空白查询影响筛选逻辑。
 */
function parseSearchTerm(request: Request): string {
  const { searchParams } = new URL(request.url);
  return (searchParams.get("query") ?? "").trim();
}

/**
 * 解析是否仅显示预报单（待入库）。
 */
function parseForecastOnly(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  return searchParams.get("forecastOnly") === "1";
}

/**
 * 可选字符串裁剪。
 */
function cleanText(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * 标准化为非负数；非法值返回 0。
 */
function toNonNegativeNumber(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return value;
}

/**
 * 汇总产品行并计算总重量/总体积。
 */
function summarizeProducts(products: CreateProduct[]): {
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
 * 校验运单创建入参。
 */
function validatePayload(payload: CreateTransportBillBody): string | null {
  if (!payload.warehouse || !VALID_WAREHOUSES.includes(payload.warehouse)) {
    return "仓库参数无效";
  }
  if (
    !payload.shippingMethod ||
    !VALID_SHIPPING_METHODS.includes(payload.shippingMethod)
  ) {
    return "运输方式参数无效";
  }
  if (
    typeof payload.unitPrice !== "number" ||
    Number.isNaN(payload.unitPrice) ||
    payload.unitPrice < 0
  ) {
    return "单价必须是大于等于 0 的数字";
  }
  if (!payload.clientUserId || !payload.clientUserId.trim()) {
    return "请选择所属客户";
  }

  const products = payload.products ?? [];
  if (products.length > 0) {
    for (let i = 0; i < products.length; i += 1) {
      const p = products[i] as CreateProduct;
      if (!cleanText(p.productName)) {
        return `第 ${i + 1} 行：请填写产品名称`;
      }
      if (!Number.isInteger(p.boxCount) || (p.boxCount ?? 0) < 1) {
        return `第 ${i + 1} 行：箱数须为不小于 1 的整数`;
      }
      if (!Number.isInteger(p.unitsPerBox) || (p.unitsPerBox ?? 0) < 1) {
        return `第 ${i + 1} 行：每箱产品数须为不小于 1 的整数`;
      }
    }
    return null;
  }

  if (
    typeof payload.actualCBM !== "number" ||
    Number.isNaN(payload.actualCBM) ||
    payload.actualCBM < 0
  ) {
    return "实际体积必须是大于等于 0 的数字";
  }
  if (
    typeof payload.actualWeight !== "number" ||
    Number.isNaN(payload.actualWeight) ||
    payload.actualWeight < 0
  ) {
    return "实际重量必须是大于等于 0 的数字";
  }
  return null;
}

/**
 * 查询运单列表，并附带最终费用与低消提示状态。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireStaffOrAdmin();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const searchTerm = parseSearchTerm(request);
  const forecastOnly = parseForecastOnly(request);

  const bills = await prisma.transportBill.findMany({
    where: {
      ...(forecastOnly ? { isForecastPending: true } : {}),
      ...(searchTerm
        ? {
            OR: [
              {
                trackingNumber: {
                  contains: searchTerm,
                },
              },
              {
                shippingMark: {
                  contains: searchTerm,
                },
              },
              {
                domesticTracking: {
                  contains: searchTerm,
                },
              },
              {
                containerTruckNo: {
                  contains: searchTerm,
                },
              },
              {
                clientUser: {
                  username: {
                    contains: searchTerm,
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      clientUser: {
        select: { username: true },
      },
    },
  });

  const list = bills.map((bill) => {
    const charge = calculateCharge({
      shippingMethod: bill.shippingMethod,
      actualCBM: bill.actualCBM,
      unitPrice: bill.unitPrice,
      isMinChargeWaived: bill.isMinChargeWaived,
    });

    const { clientUser, ...rest } = bill;
    return {
      ...rest,
      clientLogin: clientUser?.username ?? null,
      charge,
      hasMinCompensation:
        !bill.isMinChargeWaived && charge.minChargeDifferenceFee > 0,
    };
  });

  return NextResponse.json({ list });
}

/**
 * 创建新正式运单（XT 开头）：单号由服务端生成，支持详细产品行。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireStaffOrAdmin();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const raw = (await request.json()) as CreateTransportBillBody & {
    trackingNumber?: unknown;
  };
  if ("trackingNumber" in raw) {
    Reflect.deleteProperty(raw, "trackingNumber");
  }
  const body = raw;
  const error = validatePayload(body);

  if (error) {
    return NextResponse.json({ message: error }, { status: 400 });
  }

  const warehouse = body.warehouse as Warehouse;
  const shippingMethod = body.shippingMethod as ShippingMethod;
  const unitPrice = body.unitPrice as number;
  const isMinChargeWaived = Boolean(body.isMinChargeWaived);
  const clientUserId = (body.clientUserId ?? "").trim();

  const customer = await prisma.user.findFirst({
    where: {
      id: clientUserId,
      role: "CLIENT",
      isBanned: false,
    },
    select: {
      id: true,
      username: true,
    },
  });
  if (!customer) {
    return NextResponse.json({ message: "所属客户无效或已被禁用" }, { status: 400 });
  }

  let actualCBM = body.actualCBM as number;
  let actualWeight = body.actualWeight as number;
  let totalPackages: number | null = null;
  let goodsName: string | null = null;
  let domesticTracking: string | null = null;
  let productCreates: BillProductCreateInput[] = [];

  const products = body.products ?? [];
  if (products.length > 0) {
    const summary = summarizeProducts(products);
    actualCBM = summary.totalVolume;
    actualWeight = summary.totalWeight;
    totalPackages = summary.totalBoxes;
    goodsName = summary.goodsName || null;
    domesticTracking = summary.domesticTracking;
    productCreates = summary.normalizedProducts.map((p, idx) => ({
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
    }));
  }

  const charge = calculateCharge({
    shippingMethod,
    actualCBM,
    unitPrice,
    isMinChargeWaived,
  });

  const bill = await issueWarehouseBillTrackingNumberWithTransaction(
    prisma,
    warehouse,
    new Date(),
    async (tx, trackingNumber) =>
      tx.transportBill.create({
        data: {
          trackingNumber,
          warehouse,
          shippingMethod,
          actualCBM,
          actualWeight,
          unitPrice,
          isMinChargeWaived,
          isForecastPending: false,
          shipmentStatus: "INBOUND_CONFIRMED",
          clientUserId: customer.id,
          shippingMark: customer.username,
          domesticTracking,
          goodsName,
          estimatedPieces: totalPackages,
          destinationCountry: "泰国",
          departureDate: null,
          preOrderStatus: "PRE_ALERT",
          remark: null,
          totalPackages,
          declaredTotalWeight: actualWeight,
          declaredTotalVolume: actualCBM,
          billProducts:
            productCreates.length > 0
              ? {
                  create: productCreates,
                }
              : undefined,
        },
      })
  );

  return NextResponse.json({
    message: "正式运单创建成功",
    bill,
    charge,
  });
}
