import { Prisma } from "@/app/generated/prisma/client";
import type {
  TrackingSerialKind,
  Warehouse,
} from "@/app/generated/prisma/client";
import type { PrismaClient } from "@/app/generated/prisma/client";
import {
  formatDateToYYYYMMDD,
  formatPreOrderTrackingNumber,
  formatWarehouseBillTrackingNumber,
  WAREHOUSE_PREFIX,
} from "@/lib/core/tracking-number-utils";

export { formatDateToYYYYMMDD } from "@/lib/core/tracking-number-utils";

/**
 * 构造当日、该仓库、该类型（预报/正式）的单号前缀。
 */
function buildTrackingNumberPrefix(
  kind: TrackingSerialKind,
  warehouse: Warehouse,
  dateKey: string
): string {
  const code = WAREHOUSE_PREFIX[warehouse];
  if (kind === "PRE_ORDER") {
    return `YB${code}${dateKey}`;
  }
  return `${code}${dateKey}`;
}

/**
 * 将前缀中的正则特殊字符转义，用于拼接校验用正则。
 */
function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 在事务内查询 TransportBill：当日、该仓库、同前缀下已存在的最大 4 位流水，返回下一流水号。
 * 不依赖 TrackingSerialCounter，避免计数表与真实单号不同步导致唯一约束冲突。
 */
export async function allocateNextSerialFromBillsInTransaction(
  tx: Prisma.TransactionClient,
  kind: TrackingSerialKind,
  warehouse: Warehouse,
  dateKey: string
): Promise<number> {
  const prefix = buildTrackingNumberPrefix(kind, warehouse, dateKey);
  const rows = await tx.transportBill.findMany({
    where: {
      warehouse,
      trackingNumber: { startsWith: prefix },
    },
    select: { trackingNumber: true },
  });
  const exactRe = new RegExp(`^${escapeRegexLiteral(prefix)}(\\d{4})$`);
  let maxSerial = 0;
  for (const r of rows) {
    const m = exactRe.exec(r.trackingNumber);
    if (m) {
      const n = Number.parseInt(m[1]!, 10);
      if (!Number.isNaN(n)) {
        maxSerial = Math.max(maxSerial, n);
      }
    }
  }
  const next = maxSerial + 1;
  if (next > 9999) {
    throw new Error("当日单号流水已达上限（9999），请隔日或联系管理员");
  }
  return next;
}

/**
 * 判断是否为 Prisma 唯一约束冲突（P2002），用于提交重试。
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** 唯一冲突或瞬时竞态时重试次数（≥3） */
const MAX_ISSUE_ATTEMPTS = 12;

/**
 * 生成并落库预报单正式单号：事务内按库内 MAX+1 分配流水；遇 P2002 自动重试。
 */
export async function issuePreOrderTrackingNumberWithTransaction<T>(
  prisma: PrismaClient,
  warehouse: Warehouse,
  date: Date,
  createBill: (
    tx: Prisma.TransactionClient,
    trackingNumber: string
  ) => Promise<T>
): Promise<T> {
  const dateKey = formatDateToYYYYMMDD(date);
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ISSUE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const serial = await allocateNextSerialFromBillsInTransaction(
          tx,
          "PRE_ORDER",
          warehouse,
          dateKey
        );
        const trackingNumber = formatPreOrderTrackingNumber(
          warehouse,
          dateKey,
          serial
        );
        return createBill(tx, trackingNumber);
      });
    } catch (e) {
      lastError = e;
      if (isUniqueConstraintError(e)) {
        continue;
      }
      throw e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("预报单号分配失败：超过最大重试次数");
}

/**
 * 生成仓内正式运单号并写入：事务内 MAX+1；遇 P2002 重试。
 */
export async function issueWarehouseBillTrackingNumberWithTransaction<T>(
  prisma: PrismaClient,
  warehouse: Warehouse,
  date: Date,
  createBill: (
    tx: Prisma.TransactionClient,
    trackingNumber: string
  ) => Promise<T>
): Promise<T> {
  const dateKey = formatDateToYYYYMMDD(date);
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ISSUE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const serial = await allocateNextSerialFromBillsInTransaction(
          tx,
          "WAREHOUSE_BILL",
          warehouse,
          dateKey
        );
        const trackingNumber = formatWarehouseBillTrackingNumber(
          warehouse,
          dateKey,
          serial
        );
        return createBill(tx, trackingNumber);
      });
    } catch (e) {
      lastError = e;
      if (isUniqueConstraintError(e)) {
        continue;
      }
      throw e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("运单号分配失败：超过最大重试次数");
}
