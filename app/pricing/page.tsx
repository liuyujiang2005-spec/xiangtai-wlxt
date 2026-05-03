import path from "path";
import fs from "fs";
import { DEFAULT_PRICING, type PricingContent } from "@/lib/pricing-defaults";
import { CurrencyAmount } from "@/app/components/CurrencyAmount";

// 强制动态渲染：每次请求重新读取配置文件，保证管理员保存后即时生效
export const dynamic = "force-dynamic";

const CONFIG_PATH = path.join(process.cwd(), "data", "pricing-config.json");

/**
 * 读取当前生效的报价配置（管理员编辑后写入 data/pricing-config.json）。
 */
function loadPricing(): PricingContent {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as PricingContent;
    }
  } catch {
    /* 读取或解析失败时回退默认值 */
  }
  return DEFAULT_PRICING;
}

/**
 * 头程陆运/海运报价参考（内容由管理员在 /admin/pricing 中维护）。
 */
export default function PricingReferencePage() {
  const p = loadPricing();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-brand-dark sm:px-6">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <h1 className="text-xl font-semibold text-brand sm:text-2xl">
          {p.companyName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{p.subtitle}</p>
        <p className="mt-1 text-xs text-slate-600">{p.headerNote}</p>
      </header>

      {/* 陆运 */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-brand-dark">
          一、陆运（目的地：泰国曼谷）
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          装柜后时效约 <strong>{p.land.transitDays}</strong>（以实际排期为准）。
          适用仓库：深圳 / 义乌 / 广州等。
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-medium">货物类型</th>
                <th className="px-3 py-2 font-medium">说明</th>
                <th className="px-3 py-2 font-medium">单价（RMB/方）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.land.rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-slate-600">{row.desc}</td>
                  <td className="px-3 py-2">
                    <CurrencyAmount value={row.price} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>义乌陆运特别说明：</strong>
          义乌仓陆运在上述价格基础上另加{" "}
          <CurrencyAmount value={p.land.yiwuSurcharge} className="inline text-amber-900" />
          /方；计重比按 <strong>0.5 KG/KG</strong>（择大计费，以报价单约定为准）。
        </div>
      </section>

      {/* 海运 */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-brand-dark">
          二、海运（目的地：泰国曼谷）
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          开船后时效约 <strong>{p.sea.transitDays}</strong>（以船期为准）。
          适用仓库：深圳 / 义乌 / 广州等。
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-medium">货物类型</th>
                <th className="px-3 py-2 font-medium">说明</th>
                <th className="px-3 py-2 font-medium">单价（RMB/方）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.sea.rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-slate-600">{row.desc}</td>
                  <td className="px-3 py-2">
                    <CurrencyAmount value={row.price} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 计费规则 */}
      <section className="mb-8 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-brand-dark">
        <h3 className="mb-2 font-semibold text-red-900">
          三、计费与低消（与系统录单规则对齐）
        </h3>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>重泡比：</strong>若 1 方（CBM）对应重量{" "}
            <strong>&gt; 500 KG</strong>，按<strong>重量</strong>
            计费；若 1 方 <strong>&lt; 500 KG</strong>，按<strong>体积</strong>
            计费（具体以开单规则为准）。
          </li>
          <li>
            <strong>最低消费（低消）：</strong>陆运{" "}
            <strong>{p.billing.landMinCbm} CBM</strong>；海运{" "}
            <strong>{p.billing.seaMinCbm} CBM</strong>
            （与本系统低消逻辑一致）。
          </li>
        </ul>
      </section>

      {/* 条款 */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-brand-dark">四、条款摘要</h2>
        <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
          {p.terms.map((term, i) => (
            <li key={i}>{term}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
