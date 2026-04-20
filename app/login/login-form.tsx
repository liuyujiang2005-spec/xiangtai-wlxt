"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";

interface LoginFormProps {
  forbiddenHint?: boolean;
  bannedHint?: boolean;
}

/**
 * 登录表单：错误提示由服务端通过 props 传入，
 * 避免在 Suspense 内使用 useSearchParams 导致的 React 19 水合问题。
 */
export function LoginForm({ forbiddenHint, bannedHint }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      let data: { message?: string; redirectTo?: string } = {};
      try { data = await response.json(); } catch {
        data = { message: response.ok ? "服务器异常" : `请求异常：HTTP ${response.status}` };
      }
      if (!response.ok) { setError(data.message ?? "登录失败"); return; }
      if (data.redirectTo) { router.push(data.redirectTo); router.refresh(); }
    } catch (e) {
      setError(e instanceof Error ? `网络异常：${e.message}` : "网络异常，请稍后再试");
    } finally { setSubmitting(false); }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="rounded-xl bg-brand/10 p-2">
            <LogIn className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-brand">湘泰物流</h1>
            <p className="text-sm text-slate-500">账号登录</p>
          </div>
        </div>

        {forbiddenHint ? (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            权限不足页面，请使用对应角色账号登录。
          </p>
        ) : null}
        {bannedHint ? (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            该账号已被禁用无法登录。如需恢复，请联系管理员。
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">账号</span>
            <input type="text" autoComplete="username"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
              value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">密码</span>
            <input type="password" autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <p className="text-xs leading-relaxed text-slate-500">
            登录请<strong>注意大小写</strong>，Allen 和 allen 为不同账号！
          </p>
          <button type="submit" disabled={submitting}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white disabled:bg-slate-300">
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    </main>
  );
}
