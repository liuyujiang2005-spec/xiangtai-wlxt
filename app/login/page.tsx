import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

/**
 * 登录页：读取 URL 查询参数并在服务端传给表单，
 * 避免 useSearchParams 在 Suspense 内导致的 React 19 水合问题。
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorParam = params.error ?? "";

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-57px)] items-center justify-center text-sm text-slate-500">
          加载中…
        </div>
      }
    >
      <LoginForm
        forbiddenHint={errorParam === "forbidden"}
        bannedHint={errorParam === "banned"}
      />
    </Suspense>
  );
}
