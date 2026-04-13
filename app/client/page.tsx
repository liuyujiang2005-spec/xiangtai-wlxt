import Link from "next/link";
import { Package, UserCircle } from "lucide-react";

/**
 * 客户门户首页，引导至我的运单与物流轨迹。
 */
export default function ClientHomePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Package className="h-6 w-6 text-brand" />
        <h1 className="text-xl font-semibold text-brand">客户中心</h1>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        欢迎使用湘泰物流客户门户。也可通过左侧菜单进入「我的运单」「物流轨迹」。
      </p>
      <ul className="space-y-2 text-sm">
        <li>
          <Link
            href="/customer/pricing"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            头程报价
          </Link>
        </li>
        <li>
          <Link
            href="/customer/pre-order"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            新建预报
          </Link>
        </li>
        <li>
          <Link
            href="/customer/shipments"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            我的运单
          </Link>
        </li>
        <li>
          <Link
            href="/customer/tracking"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            物流轨迹
          </Link>
        </li>
        <li>
          <Link
            href="/customer/profile"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            <span className="inline-flex items-center gap-1">
              <UserCircle className="h-4 w-4" />
              个人资料
            </span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
