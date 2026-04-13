"use client";

import { useCallback, useEffect, useState } from "react";
import { Warehouse } from "lucide-react";

/**
 * 渠道与价格管理：聚合头程报价与渠道配置入口。
 */
export default function AdminChannelsPricingPage() {
  const [seaPrice, setSeaPrice] = useState<string>("");
  const [landPrice, setLandPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  /**
   * 加载当前渠道单价。
   */
  const load = useCallback(async (): Promise<void> => {
    setMessage("");
    try {
      const response = await fetch("/api/admin/pricing-settings", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("加载失败");
      }
      const data = (await response.json()) as {
        seaPrice: number;
        landPrice: number;
      };
      setSeaPrice(String(data.seaPrice));
      setLandPrice(String(data.landPrice));
    } catch {
      setMessage("单价加载失败，请刷新后重试。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 保存海运/陆运单价。
   */
  async function handleSave(): Promise<void> {
    const sea = Number.parseFloat(seaPrice);
    const land = Number.parseFloat(landPrice);
    if (Number.isNaN(sea) || sea < 0 || Number.isNaN(land) || land < 0) {
      setMessage("请输入有效单价。");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/pricing-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seaPrice: sea, landPrice: land }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "保存失败");
      }
      setMessage("渠道单价已更新，员工端录单将自动读取最新价格。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <Warehouse className="h-7 w-7 text-brand" />
        <h1 className="text-xl font-semibold text-brand">渠道与价格管理</h1>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="mb-4 text-sm text-slate-600">维护基础单价后，员工端“直接入库”会自动带出对应价格。</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">海运单价（¥ / CBM）</span>
            <input
              value={seaPrice}
              onChange={(e) => {
                setSeaPrice(e.target.value);
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">陆运单价（¥ / CBM）</span>
            <input
              value={landPrice}
              onChange={(e) => {
                setLandPrice(e.target.value);
              }}
              className="w-full rounded border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={saving}
          className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存单价"}
        </button>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </div>
    </main>
  );
}
