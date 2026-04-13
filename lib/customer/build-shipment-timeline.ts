import type { PreOrderStatus, ShipmentStatus } from "@/app/generated/prisma/client";

export type TimelineStep = {
  /** 步骤标题 */
  title: string;
  /** 说明文案 */
  description: string;
  /** 发生时间 ISO，未完成步骤为 null */
  at: string | null;
  /** 是否已完成 */
  done: boolean;
  /** 是否为当前进行中 */
  current: boolean;
};

type BillLike = {
  createdAt: Date;
  updatedAt: Date;
  isForecastPending: boolean;
  preOrderStatus: PreOrderStatus;
  shipmentStatus: ShipmentStatus;
  statusHistories?: Array<{
    toStatus: ShipmentStatus;
    createdAt: Date;
  }>;
};

/**
 * 根据运单状态与状态历史生成客户可见的垂直时间轴。
 */
export function buildShipmentTimeline(bill: BillLike): TimelineStep[] {
  /**
   * 从历史记录中提取某个状态首次出现时间。
   */
  function getHistoryAt(status: ShipmentStatus): string | null {
    const hit = bill.statusHistories?.find((h) => h.toStatus === status);
    return hit ? hit.createdAt.toISOString() : null;
  }

  const steps: TimelineStep[] = [
    {
      title: "已下单",
      description: "系统已生成订单，等待仓库处理。",
      at: getHistoryAt("ORDERED") ?? bill.createdAt.toISOString(),
      done: true,
      current: bill.shipmentStatus === "ORDERED",
    },
  ];

  if (bill.isForecastPending) {
    steps.push({
      title: "待仓库入库",
      description: "仓库收货、称重后将更新为已入库并核算费用。",
      at: null,
      done: false,
      current: true,
    });
    return steps;
  }

  steps.push({
    title: "已入库",
    description: "仓库已确认收货，系统已按规则核算应付费用。",
    at: getHistoryAt("INBOUND_CONFIRMED") ?? bill.updatedAt.toISOString(),
    done: [
      "INBOUND_CONFIRMED",
      "LOADED",
      "CUSTOMS_CLEARING",
      "ARRIVED_TH",
      "OUT_FOR_DELIVERY",
      "SIGNED",
      "SHIPPED",
    ].includes(bill.shipmentStatus),
    current: bill.shipmentStatus === "INBOUND_CONFIRMED",
  });

  if (bill.shipmentStatus === "INBOUND_CONFIRMED") {
    return steps;
  }

  steps.push({
    title: "已装柜",
    description: "货物已完成装柜，进入跨境运输环节。",
    at: getHistoryAt("LOADED") ?? null,
    done: [
      "LOADED",
      "CUSTOMS_CLEARING",
      "ARRIVED_TH",
      "OUT_FOR_DELIVERY",
      "SIGNED",
      "SHIPPED",
    ].includes(
      bill.shipmentStatus
    ),
    current: bill.shipmentStatus === "LOADED" || bill.shipmentStatus === "SHIPPED",
  });
  if (bill.shipmentStatus === "LOADED" || bill.shipmentStatus === "SHIPPED") {
    return steps;
  }
  steps.push({
    title: "清关中",
    description: "货物正在清关处理中。",
    at: getHistoryAt("CUSTOMS_CLEARING") ?? null,
    done: ["CUSTOMS_CLEARING", "ARRIVED_TH", "OUT_FOR_DELIVERY", "SIGNED"].includes(
      bill.shipmentStatus
    ),
    current: bill.shipmentStatus === "CUSTOMS_CLEARING",
  });
  if (bill.shipmentStatus === "CUSTOMS_CLEARING") {
    return steps;
  }
  steps.push({
    title: "到达泰国",
    description: "货物已到达泰国，等待末端派送。",
    at: getHistoryAt("ARRIVED_TH") ?? null,
    done: ["ARRIVED_TH", "OUT_FOR_DELIVERY", "SIGNED"].includes(bill.shipmentStatus),
    current: bill.shipmentStatus === "ARRIVED_TH",
  });
  if (bill.shipmentStatus === "ARRIVED_TH") {
    return steps;
  }
  steps.push({
    title: "待派送",
    description: "末端配送中，请保持电话畅通。",
    at: getHistoryAt("OUT_FOR_DELIVERY") ?? null,
    done: ["OUT_FOR_DELIVERY", "SIGNED"].includes(bill.shipmentStatus),
    current: bill.shipmentStatus === "OUT_FOR_DELIVERY",
  });
  if (bill.shipmentStatus === "OUT_FOR_DELIVERY") {
    return steps;
  }
  steps.push({
    title: "已签收",
    description: "货物已完成签收。",
    at: getHistoryAt("SIGNED") ?? bill.updatedAt.toISOString(),
    done: bill.shipmentStatus === "SIGNED",
    current: bill.shipmentStatus === "SIGNED",
  });
  return steps;
}
