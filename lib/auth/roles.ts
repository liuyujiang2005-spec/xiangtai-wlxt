import type { UserRole } from "@/app/generated/prisma/client";

/**
 * 根据角色返回登录后的默认首页路径。
 */
export function getHomePathForRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "STAFF":
      return "/staff";
    case "CLIENT":
      return "/customer/shipments";
    default:
      return "/login";
  }
}

/**
 * 判断角色是否可访问仓库运单管理（录单、列表、豁免等）。
 */
export function canAccessWarehouseFeatures(role: UserRole): boolean {
  return role === "ADMIN" || role === "STAFF";
}
