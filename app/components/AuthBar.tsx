"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LogOut, User } from "lucide-react";

type MeUser = {
  username: string;
  role: string;
  /** 仅客户角色可能返回，用于顶栏展示 */
  realName?: string | null;
};

/**
 * 顶栏用户信息与退出按钮，未登录时不渲染内容。
 */
export function AuthBar() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * 拉取当前会话对应的用户信息。
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
        setUser(null);
        return;
      }
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = (await response.json()) as { user: MeUser | null };
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  /**
   * 调用退出接口并跳转登录页。
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    /**
     * 个人资料保存后触发顶栏刷新显示名。
     */
    function onProfileUpdated(): void {
      void loadMe();
    }
    window.addEventListener("xt-profile-updated", onProfileUpdated);
    return () => {
      window.removeEventListener("xt-profile-updated", onProfileUpdated);
    };
  }, [loadMe]);

  if (loading || !user) {
    return null;
  }

  const roleLabel =
    user.role === "ADMIN"
      ? "管理员"
      : user.role === "STAFF"
        ? "员工"
        : user.role === "CLIENT"
          ? "客户"
          : user.role;

  const displayName =
    user.role === "CLIENT" && user.realName?.trim()
      ? user.realName.trim()
      : user.username;

  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className="hidden items-center gap-1 sm:inline-flex">
        <User className="h-4 w-4" />
        <span className="max-w-[140px] truncate" title={displayName}>
          {displayName}
        </span>
        {user.role === "CLIENT" && user.realName?.trim() ? (
          <span className="max-w-[80px] truncate text-xs text-slate-400">
            ({user.username})
          </span>
        ) : null}
        <span className="text-slate-400">·</span>
        <span>{roleLabel}</span>
      </span>
      <button
        type="button"
        onClick={() => {
          void handleLogout();
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
      >
        <LogOut className="h-3.5 w-3.5" />
        退出
      </button>
    </div>
  );
}
