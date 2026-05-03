import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCharge } from "@/lib/core/billing";
import { requireClient } from "@/lib/auth/require-client";
import { isNextResponse } from "@/lib/auth/is-next-response";
import { getClientShipmentStatusLabel } from "@/lib/customer/shipment-display";
import { handleApiError } from "@/lib/api-error";

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
 * 客户只读运单列表：仅返回当前登录客户关联的运单（含预报单），含状态文案与待支付金额。
 * 支持 query 参数搜索运单号/唛头/国内单号/货名，但仍限制在本账号范围内。
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireClient();
    if (isNextResponse(auth)) {
      return auth;
    }

    const { page, pageSize } = parsePagination(request);
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") ?? "").trim();

    const baseWhere = { clientUserId: auth.sub };
    const where = query
      ? {
          ...baseWhere,
          OR: [
            { trackingNumber: { contains: query } },
            { shippingMark: { contains: query } },
            { domesticTracking: { contains: query } },
            { goodsName: { contains: query } },
          ],
        }
      : baseWhere;

    const [total, bills] = await Promise.all([
      prisma.transportBill.count({ where }),
      prisma.transportBill.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const list = bills.map((bill) => {
      const effectiveWaived = bill.isWaived || bill.isMinChargeWaived;
      const charge = calculateCharge({
        shippingMethod: bill.shippingMethod,
        actualCBM: bill.actualCBM,
        unitPrice: bill.unitPrice,
        isMinChargeWaived: effectiveWaived,
      });
      return {
        id: bill.id,
        trackingNumber: bill.trackingNumber,
        warehouse: bill.warehouse,
        shippingMethod: bill.shippingMethod,
        destinationCountry: bill.destinationCountry,
        preOrderStatus: bill.preOrderStatus,
        totalPackages: bill.totalPackages,
        actualCBM: bill.actualCBM,
        actualWeight: bill.actualWeight,
        unitPrice: bill.unitPrice,
        isMinChargeWaived: effectiveWaived,
        isWaived: effectiveWaived,
        waivedAmount: effectiveWaived ? bill.waivedAmount : 0,
        isForecastPending: bill.isForecastPending,
        domesticTracking: bill.domesticTracking,
        goodsName: bill.goodsName,
        estimatedPieces: bill.estimatedPieces,
        shippingMark: bill.shippingMark ?? auth.username,
        createdAt: bill.createdAt,
        statusLabel: getClientShipmentStatusLabel({
          isForecastPending: bill.isForecastPending,
          preOrderStatus: bill.preOrderStatus,
          shipmentStatus: bill.shipmentStatus,
        }),
        pendingAmount: charge.finalCharge,
        charge,
        hasMinCompensation:
          !effectiveWaived && charge.minChargeDifferenceFee > 0,
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
    return handleApiError(error);
  }
}
