"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Trash2, PackageCheck, RefreshCcw } from "lucide-react";
import { DEFAULT_PRICING, type PricingContent, type PricingRow } from "@/lib/pricing-defaults";

/** 深拷贝，确保 state 修改不污染默认值 */
function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string };
function LabeledInput({ label, className = "", ...rest }: InputProps) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-[rgba(0,0,0,0.65)]">{label}</span>
      <input
        {...rest}
        className={`rounded border border-[#d9d9d9] px-2.5 py-1.5 text-sm outline-none focus:border-[#1677ff] focus:ring-1 focus:ring-[#1677ff] ${className}`}
      />
    </label>
  );
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };
function LabeledTextarea({ label, className = "", ...rest }: TextAreaProps) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-[rgba(0,0,0,0.65)]">{label}</span>
      <textarea
        {...rest}
        className={`rounded border border-[#d9d9d9] px-2.5 py-1.5 text-sm outline-none focus:border-[#1677ff] focus:ring-1 focus:ring-[#1677ff] ${className}`}
      />
    </label>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#d9d9d9] bg-white">
      <div className="border-b border-[#f0f0f0] bg-[#fafafa] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-[rgba(0,0,0,0.88)]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PriceRowEditor({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  row: PricingRow;
  index: number;
  onChange: (i: number, updated: PricingRow) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_2fr_auto_auto] items-end gap-2 rounded border border-[#f0f0f0] bg-[#fafafa] p-3">
      <LabeledInput
        label="货物类型"
        value={row.name}
        onChange={(e) => onChange(index, { ...row, name: e.target.value })}
      />
      <LabeledInput
        label="说明"
        value={row.desc}
        onChange={(e) => onChange(index, { ...row, desc: e.target.value })}
      />
      <LabeledInput
        label="单价（元/方）"
        type="number"
        min={0}
        value={row.price}
        onChange={(e) => onChange(index, { ...row, price: Number(e.target.value) })}
        className="w-28"
      />
      <button
        type="button"
        title="删除此行"
        disabled={!canRemove}
        onClick={() => onRemove(index)}
        className="mb-0.5 flex h-8 w-8 items-center justify-center rounded border border-[#ffa39e] bg-[#fff1f0] text-red-500 hover:bg-[#ffccc7] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * 管理员头程报价单编辑器。
 */
export default function AdminPricingPage() {
  const [content, setContent] = useState<PricingContent>(deepClone(DEFAULT_PRICING));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pricing-content", { credentials: "include" });
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as { content: PricingContent };
      setContent(deepClone(data.content));
    } catch {
      setError("加载报价单内容失败，已显示默认值。");
      setContent(deepClone(DEFAULT_PRICING));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/pricing-content", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "保存失败");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (window.confirm("确认重置为系统默认值？当前所有修改将丢失。")) {
      setContent(deepClone(DEFAULT_PRICING));
    }
  }

  // 陆运行修改
  function updateLandRow(i: number, row: PricingRow) {
    setContent((prev) => {
      const rows = [...prev.land.rows];
      rows[i] = row;
      return { ...prev, land: { ...prev.land, rows } };
    });
  }
  function removeLandRow(i: number) {
    setContent((prev) => ({
      ...prev,
      land: { ...prev.land, rows: prev.land.rows.filter((_, idx) => idx !== i) },
    }));
  }
  function addLandRow() {
    setContent((prev) => ({
      ...prev,
      land: {
        ...prev.land,
        rows: [...prev.land.rows, { name: "新货物类型", desc: "", price: 0 }],
      },
    }));
  }

  // 海运行修改
  function updateSeaRow(i: number, row: PricingRow) {
    setContent((prev) => {
      const rows = [...prev.sea.rows];
      rows[i] = row;
      return { ...prev, sea: { ...prev.sea, rows } };
    });
  }
  function removeSeaRow(i: number) {
    setContent((prev) => ({
      ...prev,
      sea: { ...prev.sea, rows: prev.sea.rows.filter((_, idx) => idx !== i) },
    }));
  }
  function addSeaRow() {
    setContent((prev) => ({
      ...prev,
      sea: {
        ...prev.sea,
        rows: [...prev.sea.rows, { name: "新货物类型", desc: "", price: 0 }],
      },
    }));
  }

  // 条款修改
  function updateTerm(i: number, val: string) {
    setContent((prev) => {
      const terms = [...prev.terms];
      terms[i] = val;
      return { ...prev, terms };
    });
  }
  function removeTerm(i: number) {
    setContent((prev) => ({ ...prev, terms: prev.terms.filter((_, idx) => idx !== i) }));
  }
  function addTerm() {
    setContent((prev) => ({ ...prev, terms: [...prev.terms, ""] }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-[rgba(0,0,0,0.45)]">
        加载中…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* 页头 */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#1677ff]" />
            <h1 className="text-base font-semibold text-[rgba(0,0,0,0.88)]">
              头程报价单编辑
            </h1>
            <span className="rounded bg-[#e6f4ff] px-1.5 py-0.5 text-[10px] font-medium text-[#1677ff]">
              管理员
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded border border-[#d9d9d9] bg-white px-3 py-1.5 text-sm text-[rgba(0,0,0,0.65)] hover:border-[#1677ff] hover:text-[#1677ff]"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              恢复默认
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded border border-[#1677ff] bg-[#1677ff] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#4096ff] disabled:opacity-60"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              {saving ? "保存中…" : "保 存"}
            </button>
          </div>
        </div>

        {saved && (
          <div className="mb-4 rounded border border-[#b7eb8f] bg-[#f6ffed] px-3 py-2 text-sm text-[#389e0d]">
            ✓ 报价单已保存，前台页面即时生效。
          </div>
        )}
        {error && (
          <div className="mb-4 rounded border border-[#ffa39e] bg-[#fff1f0] px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-5">
          {/* 公司基本信息 */}
          <SectionCard title="公司基本信息">
            <div className="flex flex-col gap-3">
              <LabeledInput
                label="公司名称"
                value={content.companyName}
                onChange={(e) => setContent((p) => ({ ...p, companyName: e.target.value }))}
              />
              <LabeledInput
                label="副标题（联系人 / 报价单主题）"
                value={content.subtitle}
                onChange={(e) => setContent((p) => ({ ...p, subtitle: e.target.value }))}
              />
              <LabeledTextarea
                label="页头说明"
                rows={2}
                value={content.headerNote}
                onChange={(e) => setContent((p) => ({ ...p, headerNote: e.target.value }))}
              />
            </div>
          </SectionCard>

          {/* 陆运 */}
          <SectionCard title="一、陆运价格表">
            <div className="flex flex-col gap-3">
              <LabeledInput
                label="时效说明（如：5–7 天）"
                value={content.land.transitDays}
                onChange={(e) =>
                  setContent((p) => ({ ...p, land: { ...p.land, transitDays: e.target.value } }))
                }
                className="w-48"
              />
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-[rgba(0,0,0,0.65)]">价格行</span>
                {content.land.rows.map((row, i) => (
                  <PriceRowEditor
                    key={i}
                    row={row}
                    index={i}
                    onChange={updateLandRow}
                    onRemove={removeLandRow}
                    canRemove={content.land.rows.length > 1}
                  />
                ))}
                <button
                  type="button"
                  onClick={addLandRow}
                  className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-[#d9d9d9] py-2 text-xs text-[rgba(0,0,0,0.45)] hover:border-[#1677ff] hover:text-[#1677ff]"
                >
                  <Plus className="h-3 w-3" /> 添加货物类型
                </button>
              </div>
              <LabeledInput
                label="义乌仓附加费（元/方）"
                type="number"
                min={0}
                value={content.land.yiwuSurcharge}
                onChange={(e) =>
                  setContent((p) => ({
                    ...p,
                    land: { ...p.land, yiwuSurcharge: Number(e.target.value) },
                  }))
                }
                className="w-36"
              />
            </div>
          </SectionCard>

          {/* 海运 */}
          <SectionCard title="二、海运价格表">
            <div className="flex flex-col gap-3">
              <LabeledInput
                label="时效说明（如：12–15 天）"
                value={content.sea.transitDays}
                onChange={(e) =>
                  setContent((p) => ({ ...p, sea: { ...p.sea, transitDays: e.target.value } }))
                }
                className="w-48"
              />
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-[rgba(0,0,0,0.65)]">价格行</span>
                {content.sea.rows.map((row, i) => (
                  <PriceRowEditor
                    key={i}
                    row={row}
                    index={i}
                    onChange={updateSeaRow}
                    onRemove={removeSeaRow}
                    canRemove={content.sea.rows.length > 1}
                  />
                ))}
                <button
                  type="button"
                  onClick={addSeaRow}
                  className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-[#d9d9d9] py-2 text-xs text-[rgba(0,0,0,0.45)] hover:border-[#1677ff] hover:text-[#1677ff]"
                >
                  <Plus className="h-3 w-3" /> 添加货物类型
                </button>
              </div>
            </div>
          </SectionCard>

          {/* 计费规则 */}
          <SectionCard title="三、计费与最低消费">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <LabeledInput
                label="陆运低消（CBM）"
                value={content.billing.landMinCbm}
                onChange={(e) =>
                  setContent((p) => ({
                    ...p,
                    billing: { ...p.billing, landMinCbm: e.target.value },
                  }))
                }
              />
              <LabeledInput
                label="海运低消（CBM）"
                value={content.billing.seaMinCbm}
                onChange={(e) =>
                  setContent((p) => ({
                    ...p,
                    billing: { ...p.billing, seaMinCbm: e.target.value },
                  }))
                }
              />
            </div>
          </SectionCard>

          {/* 条款 */}
          <SectionCard title="四、条款摘要">
            <div className="flex flex-col gap-2">
              {content.terms.map((term, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 min-w-[18px] text-xs text-[rgba(0,0,0,0.45)]">
                    {i + 1}.
                  </span>
                  <textarea
                    rows={2}
                    value={term}
                    onChange={(e) => updateTerm(i, e.target.value)}
                    className="flex-1 rounded border border-[#d9d9d9] px-2.5 py-1.5 text-sm outline-none focus:border-[#1677ff] focus:ring-1 focus:ring-[#1677ff]"
                  />
                  <button
                    type="button"
                    onClick={() => removeTerm(i)}
                    disabled={content.terms.length <= 1}
                    className="mt-1.5 flex h-7 w-7 items-center justify-center rounded border border-[#ffa39e] bg-[#fff1f0] text-red-500 hover:bg-[#ffccc7] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addTerm}
                className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-[#d9d9d9] py-2 text-xs text-[rgba(0,0,0,0.45)] hover:border-[#1677ff] hover:text-[#1677ff]"
              >
                <Plus className="h-3 w-3" /> 添加条款
              </button>
            </div>
          </SectionCard>
        </div>

        {/* 底部保存 */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded border border-[#1677ff] bg-[#1677ff] px-6 py-2 text-sm font-medium text-white hover:bg-[#4096ff] disabled:opacity-60"
          >
            <PackageCheck className="h-4 w-4" />
            {saving ? "保存中…" : "保存并生效"}
          </button>
        </div>
      </div>
    </div>
  );
}
