import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthSecret } from "@/lib/auth/config";
import {
  canAccessWarehouseFeatures,
  getHomePathForRole,
} from "@/lib/auth/roles";
import {
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth/session-token";

/**
 * 判断路径是否为静态资源或 Next 内部路径，中间件直接放行。
 */
function isPublicAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:ico|png|jpg|jpeg|svg|webp|gif)$/.test(pathname)
  );
}

/**
 * 页面级权限：
 * - 未登录：除 /login 外重定向登录页
 * - Admin：/admin/*（含财务统计）、运单模块、豁免接口（由 API 再校验）
 * - Staff：/staff/*、运单模块（列表无豁免按钮，接口 PATCH 仅管理员）
 * - Client：仅 /customer/*（含头程报价镜像页）；访问 /client/*、/pricing 将重定向至 /customer 下对应页
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublicAssetPath(pathname)) {
    return NextResponse.next();
  }

  const secret = getAuthSecret();
  const token = request.cookies.get(getSessionCookieName())?.value ?? null;
  const session = token ? await verifySessionToken(token, secret) : null;

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL(getHomePathForRole(session.role), request.url)
      );
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(
      new URL(getHomePathForRole(session.role), request.url)
    );
  }

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/customer")
  ) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
      return NextResponse.redirect(
        new URL("/login?error=forbidden", request.url)
      );
    }
    if (pathname.startsWith("/staff") && session.role !== "STAFF") {
      return NextResponse.redirect(
        new URL("/login?error=forbidden", request.url)
      );
    }
    if (
      (pathname.startsWith("/client") || pathname.startsWith("/customer")) &&
      session.role !== "CLIENT"
    ) {
      return NextResponse.redirect(
        new URL("/login?error=forbidden", request.url)
      );
    }
    if (session.role === "CLIENT" && pathname.startsWith("/client")) {
      const rest =
        pathname === "/client" ? "" : pathname.slice("/client".length);
      const target =
        rest === "/tracking"
          ? "/customer/tracking"
          : rest === "/profile"
            ? "/customer/profile"
            : "/customer/shipments";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/transport-bills")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!canAccessWarehouseFeatures(session.role)) {
      return NextResponse.redirect(
        new URL("/login?error=forbidden", request.url)
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/pricing")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.role === "CLIENT") {
      const suffix =
        pathname === "/pricing" ? "" : pathname.slice("/pricing".length);
      return NextResponse.redirect(
        new URL(`/customer/pricing${suffix}`, request.url)
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin/:path*",
    "/staff/:path*",
    "/client/:path*",
    "/customer/:path*",
    "/transport-bills/:path*",
    "/pricing",
    "/pricing/:path*",
  ],
};
