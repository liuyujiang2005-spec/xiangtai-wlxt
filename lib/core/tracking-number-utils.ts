import type { Warehouse } from "@/app/generated/prisma/client";

/** 仓库代码（与运单号中段一致） */
export const WAREHOUSE_PREFIX: Record<Warehouse, string> = {
  YIWU: "XTYW",
  GUANGZHOU: "XTGZ",
  SHENZHEN: "XTSZ",
  DONGGUAN: "XTDG",
};

/**
 * 将日期格式化为 YYYYMMDD，用于预报单与正式单号日期段（按自然日重置流水）。
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * 将流水号格式化为 4 位固定宽度字符串。
 */
export function formatSerialFourDigits(serial: number): string {
  return String(serial).padStart(4, "0");
}

/**
 * 预报单号：YB + 仓库代码 + YYYYMMDD + 4 位流水（无随机段）。
 */
export function formatPreOrderTrackingNumber(
  warehouse: Warehouse,
  dateYYYYMMDD: string,
  serial: number
): string {
  const p = WAREHOUSE_PREFIX[warehouse];
  return `YB${p}${dateYYYYMMDD}${formatSerialFourDigits(serial)}`;
}

/**
 * 仓内正式运单号：仓库代码 + YYYYMMDD + 4 位流水（无 YB 前缀、无随机段）。
 */
export function formatWarehouseBillTrackingNumber(
  warehouse: Warehouse,
  dateYYYYMMDD: string,
  serial: number
): string {
  const p = WAREHOUSE_PREFIX[warehouse];
  return `${p}${dateYYYYMMDD}${formatSerialFourDigits(serial)}`;
}
