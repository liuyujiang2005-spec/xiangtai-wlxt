import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

/**
 * 管理员运营看板：快捷入口与说明。
 */
export default function AdminDashboardPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/10">
            <LayoutDashboard className="h-5 w-5 text-brand-accent" />
          </div>
          <h1 className="text-xl font-semibold text-brand-dark">运营看板</h1>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          欢迎使用湘泰物流管理后台。请通过左侧菜单进入各模块：订单与运单、渠道报价、关务、海外仓及财务结算等。
        </p>
        <div className="rounded-xl bg-slate-50 p-5">
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent"></span>
              <Link
                href="/transport-bills/new"
                className="font-medium text-brand transition-colors hover:text-brand-accent"
              >
                新运单录入
              </Link>
              <span className="text-slate-600">— 仓库录单与自动单号</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent"></span>
              <Link
                href="/admin/orders"
                className="font-medium text-brand transition-colors hover:text-brand-accent"
              >
                订单管理
              </Link>
              <span className="text-slate-600">— 运单列表与费用</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
