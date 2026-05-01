import type { Warehouse } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  formatDateToYYYYMMDD,
  formatPreOrderTrackingNumber,
  formatWarehouseBillTrackingNumber,
} from "@/lib/core/tracking-number-utils";
import {
  allocateNextSerialFromBillsInTransaction,
  issuePreOrderTrackingNumberWithTransaction,
  issueWarehouseBillTrackingNumberWithTransaction,
} from "@/lib/core/tracking-serial";

export {
  calculateCharge,
  type ChargeResult,
  type CalculateChargeParams,
} from "@/lib/core/charge-formulas";

export { formatDateToYYYYMMDD } from "@/lib/core/tracking-number-utils";

export {
  allocateNextSerialFromBillsInTransaction,
  issuePreOrderTrackingNumberWithTransaction,
  issueWarehouseBillTrackingNumberWithTransaction,
  isUniqueConstraintError,
} from "@/lib/core/tracking-serial";

type GenerateTrackingNumberParams = {
  warehouse: Warehouse;
  date?: Date;
};

/**
 * 生成仓内正式运单号字符串（事务内按库 MAX+1，不落库），供脚本等直接调用。
 */
export async function generateTrackingNumber(
  params: GenerateTrackingNumberParams
): Promise<string> {
  const targetDate = params.date ?? new Date();
  const warehouse = params.warehouse;
  const dateKey = formatDateToYYYYMMDD(targetDate);
  return prisma.$transaction(async (tx) => {
    const serial = await allocateNextSerialFromBillsInTransaction(
      tx,
      "WAREHOUSE_BILL",
      warehouse,
      dateKey
    );
    return formatWarehouseBillTrackingNumber(warehouse, dateKey, serial);
  });
}

/**
 * 生成预报单单号字符串（事务内按库 MAX+1，不落库），供脚本等直接调用。
 */
export async function generatePreOrderTrackingNumber(
  params: GenerateTrackingNumberParams
): Promise<string> {
  const targetDate = params.date ?? new Date();
  const warehouse = params.warehouse;
  const dateKey = formatDateToYYYYMMDD(targetDate);
  return prisma.$transaction(async (tx) => {
    const serial = await allocateNextSerialFromBillsInTransaction(
      tx,
      "PRE_ORDER",
      warehouse,
      dateKey
    );
    return formatPreOrderTrackingNumber(warehouse, dateKey, serial);
  });
}
