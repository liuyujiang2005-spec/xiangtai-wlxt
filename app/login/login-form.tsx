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
      let data: { message?: string; redirectTo?: string } = {};
      try {
        data = (await response.json()) as {
          message?: string;
          redirectTo?: string;
        };
      } catch {
        data = {
          message: response.ok
            ? "响应解析失败"
            : `服务异常（HTTP ${response.status}）`,
        };
      }
      if (!response.ok) {
        setError(data.message ?? "登录失败");
        return;
      }
      if (data.redirectTo) {
        router.push(data.redirectTo);
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error ? `网络异常：${e.message}` : "网络异常，请稍后重试"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full flex-col items-center justify-center px-4 py-8 sm:flex-row sm:gap-16 sm:px-12 lg:gap-32">
      {/* 动态背景图层 */}
      <div 
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      {/* 深色半透明遮罩层，增加 5px 模糊度与深色叠加，确保白色文字内容在任何屏幕亮度下清晰可见 */}
      <div className="absolute inset-0 -z-10 bg-slate-900/60 backdrop-blur-[5px]" />

      {/* Landing Page 独立主标题区域（左侧或上方） */}
      <div className="mb-12 flex flex-col items-center text-center sm:mb-0 sm:items-start sm:text-left">
        <h1 
          className="text-5xl font-black tracking-tight text-white drop-shadow-2xl sm:text-6xl md:text-7xl lg:text-[5rem]"
          style={{ textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}
        >
          湘泰物流
        </h1>
        <p 
          className="mt-6 max-w-md text-lg font-medium text-slate-200 drop-shadow-lg sm:text-xl lg:text-2xl"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
        >
          高效、安全、智能的跨境物流管理平台
        </p>
      </div>

      {/* 毛玻璃卡片效果 (Glassmorphism) - 提高背景不透明度确保文字清晰 */}
      <div className="relative z-10 w-full max-w-md shrink-0 rounded-2xl border border-white/60 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-brand/10 p-2.5">
            <LogIn className="h-6 w-6 text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">系统登录</h2>
            <p className="text-sm font-semibold text-slate-600">欢迎回来，请登录您的账号</p>
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
            <span className="mb-1 block font-semibold text-slate-800">账号</span>
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
              <span className="mb-1 block font-semibold text-slate-800">密码</span>
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
          <div className="mt-6 rounded-xl bg-slate-50/80 p-4">
            <p className="text-xs font-medium leading-relaxed text-slate-700">
              登录名<strong className="text-brand">区分大小写</strong>（如 Allen 与 allen 为不同账号）。若确认密码无误仍失败，请联系管理员或按内部运维流程处理账号问题。
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accent disabled:bg-slate-300"
          >
            {submitting ? "登录中…" : "立即登录"}
          </button>
        </form>
      </div>
    </main>
  );
}
