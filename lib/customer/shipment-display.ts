import type { PreOrderStatus, ShipmentStatus } from "@/app/generated/prisma/client";

type StatusInput = {
  isForecastPending: boolean;
  preOrderStatus: PreOrderStatus;
  shipmentStatus?: ShipmentStatus;
};

/**
 * 客户端列表/详情：将预录单状态映射为「已预报 / 未到齐 / 已到库 / 已发货」。
 */
export function getClientShipmentStatusLabel(input: StatusInput): string {
  if (input.isForecastPending) {
    return "已预报";
  }
  if (input.shipmentStatus === "ORDERED") {
    return "已下单";
  }
  if (input.shipmentStatus === "LOADED") {
    return "已装柜";
  }
  if (input.shipmentStatus === "CUSTOMS_CLEARING") {
    return "清关中";
  }
  if (input.shipmentStatus === "ARRIVED_TH") {
    return "到达泰国";
  }
  if (input.shipmentStatus === "OUT_FOR_DELIVERY") {
    return "待派送";
  }
  if (input.shipmentStatus === "SIGNED") {
    return "已签收";
  }
  if (input.shipmentStatus === "SHIPPED") {
    return "已发货";
  }
  if (input.shipmentStatus === "INBOUND_CONFIRMED") {
    return "已到库";
  }
  switch (input.preOrderStatus) {
    case "PRE_ALERT":
      return "未到齐";
    case "ARRIVED_FULL":
      return "已到库";
    case "SHIPPED":
      return "已发货";
    default:
      return "—";
  }
}

/**
 * 人民币金额展示（统一 ¥ 前缀）。
 */
export function formatCny(amount: number): string {
  if (Number.isNaN(amount) || !Number.isFinite(amount)) {
    return "¥0.00";
  }
  return `¥${amount.toFixed(2)}`;
}
