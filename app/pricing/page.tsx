import { CurrencyAmount } from "@/app/components/CurrencyAmount";

/**
 * 头程陆运/海运报价参考（摘自公司报价单，供录单与对外说明使用）。
 */
export default function PricingReferencePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-800 sm:px-6">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <h1 className="text-xl font-semibold text-brand sm:text-2xl">
          广州湘泰国际物流有限公司
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          联系人：湘泰 · 报价单主题：头程陆运 / 海运费用（中国 → 泰国曼谷）
        </p>
        <p className="mt-1 text-xs text-slate-500">
          以下价格单位为人民币（RMB），按体积为「元/方（CBM）」；具体以业务确认为准。
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">一、陆运（目的地：泰国曼谷）</h2>
        <p className="mb-4 text-sm text-slate-600">
          装柜后时效约 <strong>5–7 天</strong>（以实际排期为准）。适用仓库：深圳 / 义乌 / 广州等。
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
              <tr>
                <td className="px-3 py-2">陆运普货</td>
                <td className="px-3 py-2 text-slate-600">
                  不带电、不带磁、非品牌等
                </td>
                <td className="px-3 py-2">
                  <CurrencyAmount value={1070} />
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">陆运商检</td>
                <td className="px-3 py-2 text-slate-600">
                  带电、高货值、化妆品、木制品、机械、液体等需商检类
                </td>
                <td className="px-3 py-2">
                  <CurrencyAmount value={1250} />
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">陆运敏感货</td>
                <td className="px-3 py-2 text-slate-600">
                  锂电池、品牌、化工、粉末等敏感品
                </td>
                <td className="px-3 py-2">
                  <CurrencyAmount value={1350} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>义乌陆运特别说明：</strong>
          义乌仓陆运在上述价格基础上另加{" "}
          <CurrencyAmount value={120} className="inline text-amber-900" />
          /方；计重比按{" "}
          <strong>0.5 KG/KG</strong>（择大计费，以报价单约定为准）。
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">二、海运（目的地：泰国曼谷）</h2>
        <p className="mb-4 text-sm text-slate-600">
          开船后时效约 <strong>12–15 天</strong>（以船期为准）。适用仓库：深圳 / 义乌 / 广州等。
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
              <tr>
                <td className="px-3 py-2">海运普货</td>
                <td className="px-3 py-2 text-slate-600">
                  毛巾、胶袋、日用品等（无品牌、无液体/粉末等限制品）
                </td>
                <td className="px-3 py-2">
                  <CurrencyAmount value={550} />
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">海运商检</td>
                <td className="px-3 py-2 text-slate-600">
                  带电、高货值、化妆品、木材、机械、液体等
                </td>
                <td className="px-3 py-2">
                  <CurrencyAmount value={700} />
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">海运敏感货</td>
                <td className="px-3 py-2 text-slate-600">
                  化工、线香、食品添加剂、品牌货等
                </td>
                <td className="px-3 py-2">
                  <CurrencyAmount value={800} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-slate-800">
        <h3 className="mb-2 font-semibold text-red-900">三、计费与低消（与系统录单规则对齐）</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>重泡比：</strong>若 1 方（CBM）对应重量 <strong>&gt; 500 KG</strong>，按<strong>重量</strong>
            计费；若 1 方 <strong>&lt; 500 KG</strong>，按<strong>体积</strong>计费（具体以开单规则为准）。
          </li>
          <li>
            <strong>最低消费（低消）：</strong>陆运 <strong>0.3 CBM</strong>；海运{" "}
            <strong>0.5 CBM</strong>（与本系统低消逻辑一致）。
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">四、条款摘要</h2>
        <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
          <li>
            报价为人民币含税参考价，含泰国关税及曼谷市内派送；曼谷以外地区另计泰国国内物流费用。
          </li>
          <li>
            客户须如实提供品名、货值、重量、品牌等信息；因申报不实导致海关查扣等，责任由客户承担。
          </li>
          <li>
            陆运单件 <strong>100–500 KG</strong> 可能产生叉车费 <strong>200 元/票</strong>；单件超{" "}
            <strong>500 KG</strong> 或单边超 <strong>120 CM</strong> 等需单独询价。
          </li>
          <li>
            遗失或损毁理赔：按出厂价核定，且不超过运费的 <strong>3 倍</strong>；高价值货物建议购买保险。
          </li>
          <li>易碎品破损一般不予理赔，请自行加强包装。</li>
          <li>
            询价时请提供：货物描述、重量、尺寸、品牌、图片及货值等资料。
          </li>
          <li>将货物交予本公司即视为接受上述条款。</li>
        </ol>
      </section>

      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
        <p>
          如需在页面内嵌原报价单扫描图，可将图片保存为{" "}
          <code className="rounded bg-slate-200 px-1">public/pricing-quote.png</code>{" "}
          后自行在页面中加入展示组件。
        </p>
      </section>
    </main>
  );
}
