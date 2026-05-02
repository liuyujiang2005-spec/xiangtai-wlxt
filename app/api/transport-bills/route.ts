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
import { isNextResponse } from "@/lib/auth/is-next-response";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";

const VALID_WAREHOUSES = [
  "YIWU",
  "GUANGZHOU",
  "SHENZHEN",
  "DONGGUAN",
] as const;
const VALID_SHIPPING_METHODS = ["SEA", "LAND"] as const;
const VALID_CARGO = ["GENERAL", "SENSITIVE", "INSPECTION"] as const;

const CreateProductSchema = z.object({
  productName: z.string().min(1, "请填写产品名称").transform(v => v.trim()),
  boxCount: z.number().int().min(1, "箱数须为不小于 1 的整数"),
  cargoType: z.enum(VALID_CARGO).optional().default("GENERAL"),
  unitsPerBox: z.number().int().min(1, "每箱产品数须为不小于 1 的整数"),
  domesticTracking: z.string().optional().transform(v => v?.trim()),
  inboundTracking: z.string().optional().transform(v => v?.trim()),
  sku: z.string().optional().transform(v => v?.trim()),
  boxNumber: z.string().optional().transform(v => v?.trim()),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  unitWeightKg: z.number().min(0).optional(),
  startBoxNo: z.number().int().nullable().optional(),
  endBoxNo: z.number().int().nullable().optional(),
  remark: z.string().optional().transform(v => v?.trim()),
});

type CreateProduct = z.infer<typeof CreateProductSchema>;

const CreateTransportBillSchema = z.object({
  warehouse: z.enum(VALID_WAREHOUSES, { message: "仓库参数无效" }),
  shippingMethod: z.enum(VALID_SHIPPING_METHODS, { message: "运输方式参数无效" }),
  actualCBM: z.number().min(0, "实际体积必须是大于等于 0 的数字").optional(),
  actualWeight: z.number().min(0, "实际重量必须是大于等于 0 的数字").optional(),
  unitPrice: z.number().min(0, "单价必须是大于等于 0 的数字"),
  isMinChargeWaived: z.boolean().optional(),
  clientUserId: z.string().min(1, "请选择所属客户").transform(v => v.trim()),
  products: z.array(CreateProductSchema).optional(),
}).refine(data => {
  if (data.products && data.products.length > 0) return true;
  if (data.actualCBM === undefined || data.actualWeight === undefined) {
    return false;
  }
  return true;
}, {
  message: "如果没有录入明细，必须提供实际体积和实际重量",
});

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
 * 解析分页参数。
 */
function parsePagination(request: Request): { page: number; pageSize: number } {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50", 10);
  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize: Number.isNaN(pageSize) || pageSize < 1 || pageSize > 500 ? 50 : pageSize,
  };
}

/**
 * 查询运单列表，支持分页，并附带最终费用与低消提示状态。
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireStaffOrAdmin();
    if (isNextResponse(auth)) {
      return auth;
    }

    const searchTerm = parseSearchTerm(request);
    const forecastOnly = parseForecastOnly(request);
    const { page, pageSize } = parsePagination(request);

    const where = {
      ...(forecastOnly ? { isForecastPending: true } : {}),
      ...(searchTerm
        ? {
            OR: [
              { trackingNumber: { contains: searchTerm } },
              { shippingMark: { contains: searchTerm } },
              { domesticTracking: { contains: searchTerm } },
              { containerTruckNo: { contains: searchTerm } },
              { clientUser: { username: { contains: searchTerm } } },
              { goodsName: { contains: searchTerm } },
              { billProducts: { some: { productName: { contains: searchTerm } } } },
            ],
          }
        : {}),
    };

    const [total, bills] = await Promise.all([
      prisma.transportBill.count({ where }),
      prisma.transportBill.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          clientUser: {
            select: { username: true },
          },
        },
      }),
    ]);

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

    return NextResponse.json({ 
      list,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    });
  } catch (error) {
    console.error("[api/transport-bills GET]", error);
    return NextResponse.json(
      {
        message: "运单列表查询失败，请稍后重试或联系管理员",
        list: [],
        pagination: { total: 0, page: 1, pageSize: 50, totalPages: 0 }
      },
      { status: 500 }
    );
  }
}

/**
 * 创建新正式运单（XT 开头）：单号由服务端生成，支持详细产品行。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireStaffOrAdmin();
  if (isNextResponse(auth)) {
    return auth;
  }

  try {
    const raw = await request.json();
    if (typeof raw === "object" && raw !== null && "trackingNumber" in raw) {
      Reflect.deleteProperty(raw, "trackingNumber");
    }
    const body = CreateTransportBillSchema.parse(raw);

    const warehouse = body.warehouse as Warehouse;
    const shippingMethod = body.shippingMethod as ShippingMethod;
    const unitPrice = body.unitPrice as number;
    const isMinChargeWaived = Boolean(body.isMinChargeWaived);
    const clientUserId = body.clientUserId;

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

    let actualCBM = body.actualCBM ?? 0;
    let actualWeight = body.actualWeight ?? 0;
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
  } catch (error) {
    return handleApiError(error);
  }
}
