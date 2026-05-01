import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

/**
 * 管理员运营看板：快捷入口与说明。
 */
export default function AdminDashboardPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-brand" />
        <h1 className="text-xl font-semibold text-brand">运营看板</h1>
      </div>
      <p className="mb-6 text-sm text-slate-600">
        欢迎使用湘泰物流管理后台。请通过左侧菜单进入各模块：订单与运单、渠道报价、关务、海外仓及财务结算等。
      </p>
      <ul className="space-y-2 text-sm text-slate-600">
        <li>
          <Link
            href="/transport-bills/new"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            新运单录入
          </Link>
          <span className="text-slate-500"> — 仓库录单与自动单号</span>
        </li>
        <li>
          <Link
            href="/admin/orders"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            订单管理
          </Link>
          <span className="text-slate-500"> — 运单列表与费用</span>
        </li>
      </ul>
    </main>
  );
}
