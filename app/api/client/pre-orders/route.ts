import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  PreOrderStatus,
  ProductCargoType,
  ShippingMethod,
  Warehouse,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import {
  calculateCharge,
  issuePreOrderTrackingNumberWithTransaction,
} from "@/lib/core/billing";
import { requireClient } from "@/lib/auth/require-client";
import { isNextResponse } from "@/lib/auth/is-next-response";

const IncomingProductSchema = z.object({
  productName: z.string().trim().min(1, "请填写产品名称").max(100, "产品名称过长"),
  boxCount: z.number().int("箱数必须为整数").min(1, "箱数须为不小于 1 的整数"),
  cargoType: z.enum(["GENERAL", "SENSITIVE", "INSPECTION"]).default("GENERAL"),
  unitsPerBox: z.number().int("每箱产品数必须为整数").min(1, "每箱产品数须为不小于 1 的整数"),
  domesticTracking: z.string().trim().max(100).optional().nullable(),
  sku: z.string().trim().max(100).optional().nullable(),
  boxNumber: z.string().trim().max(50).optional().nullable(),
  lengthCm: z.number().min(0, "尺寸不能为负数").optional().nullable(),
  widthCm: z.number().min(0, "尺寸不能为负数").optional().nullable(),
  heightCm: z.number().min(0, "尺寸不能为负数").optional().nullable(),
});

type IncomingProduct = z.infer<typeof IncomingProductSchema>;

const CreatePreOrderSchema = z.object({
  warehouse: z.enum(["YIWU", "GUANGZHOU", "SHENZHEN", "DONGGUAN"], {
    message: "请选择有效仓库",
  }),
  shippingMethod: z.enum(["SEA", "LAND"], {
    message: "请选择有效运输方式",
  }),
  departureDate: z.string().optional().nullable(),
  preOrderStatus: z.enum(["PRE_ALERT", "ARRIVED_FULL", "SHIPPED"]).default("PRE_ALERT"),
  remark: z.string().trim().max(500).optional().nullable(),
  destinationCountry: z.string().trim().min(1, "请填写或选择目的国家").max(100),
  totalPackages: z.number().int("总件数须为非负整数").min(0),
  declaredTotalWeight: z.number().min(0, "总重量须为非负数字"),
  declaredTotalVolume: z.number().min(0, "总体积须为非负数字"),
  products: z.array(IncomingProductSchema).min(1, "请至少添加一行产品明细"),
});

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
 * 客户提交预报单：YB 单号仅服务端在事务内生成（忽略请求体中的 trackingNumber），与 BillProduct 同事务写入。
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireClient();
    if (isNextResponse(auth)) {
      return auth;
    }

    let bodyData: unknown;
    try {
      bodyData = await request.json();
    } catch {
      return NextResponse.json({ message: "请求体格式错误" }, { status: 400 });
    }

    const body = CreatePreOrderSchema.parse(bodyData);

    const warehouse = body.warehouse as Warehouse;
    const shippingMethod = body.shippingMethod as ShippingMethod;
    const preOrderStatus = body.preOrderStatus as PreOrderStatus;
    const remark = body.remark || null;
    const destinationCountry = body.destinationCountry;
    const totalPackages = body.totalPackages;
    const declaredTotalWeight = body.declaredTotalWeight;
    const declaredTotalVolume = body.declaredTotalVolume;
    const products = body.products;

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
                productName: p.productName,
                boxCount: p.boxCount,
                cargoType: p.cargoType as ProductCargoType,
                unitsPerBox: p.unitsPerBox,
                domesticTracking: p.domesticTracking || null,
                sku: p.sku || null,
                boxNumber: p.boxNumber || null,
                lengthCm: p.lengthCm ?? null,
                widthCm: p.widthCm ?? null,
                heightCm: p.heightCm ?? null,
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
    return handleApiError(err);
  }
}
