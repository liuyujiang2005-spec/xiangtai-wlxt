"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";

/**
 * 登录表单主体，读取 URL 查询参数展示无权提示。
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const errorParam = searchParams.get("error");
  const forbiddenHint =
    errorParam === "forbidden"
      ? "无权访问该页面，请使用对应角色账号登录。"
      : "";
  const bannedHint =
    errorParam === "banned"
      ? "该账号已被封禁，无法继续使用。如有疑问请联系管理员。"
      : "";

  /**
   * 提交登录请求并处理跳转。
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        setError(data.message ?? "登录失败");
        return;
      }
      if (data.redirectTo) {
        router.push(data.redirectTo);
        router.refresh();
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
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
            {forbiddenHint}
          </p>
        ) : null}
        {bannedHint ? (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {bannedHint}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">账号</span>
            <input
              type="text"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="用户名"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">密码</span>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="密码"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
          <p className="text-xs leading-relaxed text-slate-500">
            登录名<strong>区分大小写</strong>（如 Allen 与 allen 为不同账号）。若确认密码无误仍失败，请在本机项目目录执行{" "}
            <code className="rounded bg-slate-100 px-1">npm run seed:users</code>{" "}
            恢复种子账号密码，或使用{" "}
            <code className="rounded bg-slate-100 px-1">npm run password:reset</code>{" "}
            重置。
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white disabled:bg-slate-300"
          >
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    </main>
  );
}
