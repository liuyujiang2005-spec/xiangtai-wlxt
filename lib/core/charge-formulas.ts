import type { ShippingMethod } from "@/app/generated/prisma/client";

const MIN_CBM_BY_METHOD: Record<ShippingMethod, number> = {
  SEA: 0.5,
  LAND: 0.3,
};

export type CalculateChargeParams = {
  shippingMethod: ShippingMethod;
  actualCBM: number;
  unitPrice: number;
  isMinChargeWaived: boolean;
};

export type ChargeResult = {
  actualFee: number;
  minChargeDifferenceFee: number;
  finalCharge: number;
};

/**
 * 计算运费与低消补差费用（纯函数，可供客户端与服务端共用）。
 */
export function calculateCharge(params: CalculateChargeParams): ChargeResult {
  const { shippingMethod, actualCBM, unitPrice, isMinChargeWaived } = params;
  const minCBM = MIN_CBM_BY_METHOD[shippingMethod];
  const actualFee = actualCBM * unitPrice;

  if (isMinChargeWaived) {
    return {
      actualFee,
      minChargeDifferenceFee: 0,
      finalCharge: actualFee,
    };
  }

  const chargeableCBM = Math.max(actualCBM, minCBM);
  const finalCharge = chargeableCBM * unitPrice;

  return {
    actualFee,
    minChargeDifferenceFee: finalCharge - actualFee,
    finalCharge,
  };
}
