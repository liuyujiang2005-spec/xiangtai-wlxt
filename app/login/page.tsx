import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

/**
 * 登录页：用 Suspense 包裹依赖 useSearchParams 的表单，避免构建告警。
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-57px)] items-center justify-center text-sm text-slate-500">
          加载中…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
