import Link from "next/link";
import { ClipboardList } from "lucide-react";

/**
 * 员工工作台首页，提供日常录单与查询入口。
 */
export default function StaffHomePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-brand" />
        <h1 className="text-xl font-semibold text-brand">员工工作台</h1>
      </div>
      <p className="mb-6 text-sm text-slate-600">
        仓库操作员常用：预报入库处理、客户预报查询与装柜管理。
      </p>
      <ul className="space-y-3">
        <li>
          <Link
            href="/staff/direct-inbound"
            className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-brand hover:bg-slate-50"
          >
            运单管理（入库处理）
          </Link>
        </li>
        <li>
          <Link
            href="/staff/forecast-inbound"
            className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-brand hover:bg-slate-50"
          >
            客户预报单查询
          </Link>
        </li>
        <li>
          <Link
            href="/staff/container-loading"
            className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-brand hover:bg-slate-50"
          >
            装柜管理
          </Link>
        </li>
      </ul>
    </main>
  );
}
