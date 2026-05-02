import { NextResponse } from "next/server";

/**
 * 类型守卫：判断 require* 守卫函数（requireAdmin / requireStaffOrAdmin / requireClient）
 * 的返回值是否为 NextResponse（即未通过权限校验、需要早返的响应）。
 *
 * 用法：
 *   const gate = await requireAdmin();
 *   if (isNextResponse(gate)) return gate;
 *   const session = gate; // 此处类型已收窄为 SessionPayload
 */
export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse || value instanceof Response;
}
