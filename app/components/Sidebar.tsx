"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PackagePlus,
  PenLine,
  ShieldCheck,
  Ship,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type MeResponse = {
  user: {
    username: string;
    role: "ADMIN" | "STAFF" | "CLIENT";
    realName?: string | null;
  } | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * 根据角色生成侧边导航菜单项。
 */
function buildNavItems(role: string | null): NavItem[] {
  if (role === "ADMIN") {
    return [
      { href: "/admin", label: "运营看板", icon: LayoutDashboard },
      { href: "/admin/finance", label: "财务结算与利润", icon: CircleDollarSign },
      { href: "/admin/orders", label: "全局运单审计", icon: Truck },
      { href: "/admin/loading", label: "装柜管理", icon: Package },
      { href: "/admin/channels-pricing", label: "渠道与单价管理", icon: Warehouse },
      { href: "/admin/accounts", label: "员工与客户审计", icon: Users },
      { href: "/admin/customs", label: "关务监控", icon: ShieldCheck },
      { href: "/admin/overseas-integration", label: "海外仓/末端集成", icon: Package },
    ];
  }
  if (role === "STAFF") {
    return [
      { href: "/pricing", label: "头程报价", icon: FileText },
      { href: "/staff", label: "工作台", icon: LayoutDashboard },
      { href: "/staff/direct-inbound", label: "运单管理（入库处理）", icon: ClipboardList },
      { href: "/staff/forecast-inbound", label: "客户预报单查询", icon: PenLine },
      { href: "/staff/container-loading", label: "装柜管理", icon: Package },
    ];
  }
  if (role === "CLIENT") {
    return [
      { href: "/customer/pricing", label: "头程报价", icon: FileText },
      { href: "/customer/pre-order", label: "新建预报", icon: PackagePlus },
      { href: "/customer/shipments", label: "我的运单", icon: Ship },
      { href: "/customer/tracking", label: "物流轨迹", icon: MapPin },
    ];
  }
  return [];
}

/**
 * 判断当前路径是否对应某菜单项（含管理员子路由与运单模块别名）。
 */
function isNavActive(pathname: string, href: string): boolean {
  if (href === "/admin/accounts") {
    return (
      pathname === "/admin/accounts" ||
      pathname.startsWith("/admin/staff-users") ||
      pathname.startsWith("/admin/customers")
    );
  }
  if (href === "/admin") {
    return pathname === "/admin";
  }
  if (href === "/staff") {
    return pathname === "/staff";
  }
  if (href === "/client") {
    return pathname === "/client";
  }
  if (href === "/customer/pricing") {
    return (
      pathname === "/customer/pricing" ||
      pathname.startsWith("/customer/pricing/")
    );
  }
  if (href === "/customer/pre-order") {
    return (
      pathname === "/customer/pre-order" ||
      pathname.startsWith("/customer/pre-order")
    );
  }
  if (href === "/customer/shipments") {
    return (
      pathname === "/customer/shipments" ||
      pathname.startsWith("/customer/shipments/") ||
      pathname.startsWith("/customer/waybill/")
    );
  }
  if (href === "/customer/tracking") {
    return (
      pathname === "/customer/tracking" ||
      pathname.startsWith("/customer/tracking/")
    );
  }
  if (href === "/staff/direct-inbound") {
    return pathname === "/staff/direct-inbound";
  }
  if (href === "/staff/forecast-inbound") {
    return pathname === "/staff/forecast-inbound";
  }
  if (href === "/pricing") {
    return pathname === "/pricing";
  }
  if (href === "/admin/orders") {
    return (
      pathname === "/admin/orders" ||
      pathname === "/transport-bills" ||
      pathname.startsWith("/transport-bills/")
    );
  }
  if (href === "/admin/loading") {
    return pathname === "/admin/loading" || pathname.startsWith("/admin/loading/");
  }
  if (href === "/admin/finance") {
    return pathname === "/admin/finance";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 角色中文展示名。
 */
function roleLabel(role: string | null): string {
  if (role === "ADMIN") return "管理员";
  if (role === "STAFF") return "仓库员工";
  if (role === "CLIENT") return "客户";
  return "";
}

/**
 * 侧边栏导航：按登录角色动态展示菜单并高亮当前路径。
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [realName, setRealName] = useState<string | null>(null);

  /**
   * 拉取当前用户角色用于渲染菜单。
   */
  const loadMe = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.status === 403) {
        let data: { banned?: boolean } = {};
        try {
          data = (await response.json()) as { banned?: boolean };
        } catch {
          /* 非 JSON 响应时忽略 */
        }
        if (data.banned) {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
          });
          router.push("/login?error=banned");
        }
        setRole(null);
        setRealName(null);
        return;
      }
      if (!response.ok) {
        setRole(null);
        setRealName(null);
        return;
      }
      const data = (await response.json()) as MeResponse;
      setRole(data.user?.role ?? null);
      setUsername(data.user?.username ?? "");
      setRealName(
        data.user?.role === "CLIENT" ? data.user?.realName ?? null : null
      );
    } catch {
      setRole(null);
      setRealName(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    startTransition(() => {
      void loadMe();
    });
  }, [loadMe]);

  /**
   * 调用退出接口并跳转登录页。
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    /**
     * 个人资料保存后同步侧栏展示名。
     */
    function onProfileUpdated(): void {
      void loadMe();
    }
    window.addEventListener("xt-profile-updated", onProfileUpdated);
    return () => {
      window.removeEventListener("xt-profile-updated", onProfileUpdated);
    };
  }, [loadMe]);

  const items = useMemo(() => buildNavItems(role), [role]);

  /**
   * 首屏拉取用户信息前展示占位，避免左侧导航整块消失。
   */
  if (loading) {
    return (
      <aside
        className="flex min-h-[calc(100vh-57px)] w-[13.5rem] shrink-0 flex-col border-r border-slate-200 bg-white sm:w-56"
        aria-busy="true"
        aria-label="菜单加载中"
      >
        <div className="border-b border-slate-100 px-3 py-3">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-16 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      </aside>
    );
  }

  if (!role || items.length === 0) {
    return null;
  }

  return (
    <aside className="flex min-h-[calc(100vh-57px)] w-[13.5rem] shrink-0 flex-col border-r border-slate-200 bg-white sm:w-56">
      <div className="border-b border-slate-100 px-3 py-3">
        <p className="text-xs font-semibold tracking-wide text-brand">湘泰物流</p>
        <p className="mt-2 text-xs text-slate-500">当前身份</p>
        <p className="mt-0.5 text-sm font-medium text-slate-800">
          {roleLabel(role)}
        </p>
        {username ? (
          <p className="mt-1 truncate text-xs text-slate-500">
            {role === "CLIENT" && realName?.trim()
              ? `${realName.trim()}（${username}）`
              : username}
          </p>
        ) : null}
        {role === "CLIENT" && username ? (
          <p className="mt-1.5 text-xs leading-snug text-slate-600">
            我的唛头：
            <span className="font-mono font-semibold text-slate-800">
              {username}
            </span>
          </p>
        ) : null}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pb-4">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border border-brand/50 bg-indigo-50 text-brand shadow-sm"
                  : "border border-transparent text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="leading-snug">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-slate-100 p-2">
        <button
          type="button"
          onClick={() => {
            void handleLogout();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          退出账号
        </button>
      </div>
    </aside>
  );
}
