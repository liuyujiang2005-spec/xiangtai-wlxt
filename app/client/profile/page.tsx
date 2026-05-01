"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, UserCircle } from "lucide-react";

/**
 * 客户个人资料页：可选填写真实姓名，仅登录客户可访问。
 */
export default function ClientProfilePage() {
  const router = useRouter();
  const [realName, setRealName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  /**
   * 从服务端加载当前客户的资料。
   */
  const loadProfile = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/client/profile", {
        credentials: "include",
      });
      const data = (await response.json()) as {
        username?: string;
        realName?: string | null;
        message?: string;
      };
      if (!response.ok) {
        setError(data.message ?? "加载失败");
        return;
      }
      setUsername(data.username ?? "");
      setRealName(data.realName ?? "");
    } catch {
      setError("网络异常");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  /**
   * 提交保存真实姓名（可为空表示清除）。
   */
  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/client/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realName: realName.trim() || null }),
      });
      const data = (await response.json()) as { message?: string; realName?: string | null };
      if (!response.ok) {
        setError(data.message ?? "保存失败");
        return;
      }
      setMessage(data.message ?? "已保存");
      if (data.realName !== undefined) {
        setRealName(data.realName ?? "");
      }
      router.refresh();
      window.dispatchEvent(new Event("xt-profile-updated"));
    } catch {
      setError("网络异常");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link
          href="/customer/shipments"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          返回客户中心
        </Link>
        <div className="flex items-center gap-2">
          <UserCircle className="h-7 w-7 text-brand" />
          <h1 className="text-xl font-semibold text-brand">个人资料</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          真实姓名为可选项，仅会在客户端界面展示（如顶栏、侧栏），便于您识别当前账号。
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">加载中…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">登录账号</span>
              <input
                type="text"
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
                value={username}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">真实姓名（可选）</span>
              <input
                type="text"
                autoComplete="name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="填写后仅在客户端显示"
                maxLength={50}
              />
            </label>
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}
            {message ? (
              <p className="text-sm text-emerald-700">{message}</p>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white disabled:bg-slate-300"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
