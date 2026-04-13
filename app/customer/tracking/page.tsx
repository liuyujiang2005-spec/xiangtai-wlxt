"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";

type Row = {
  id: string;
  trackingNumber: string;
};

/**
 * 物流轨迹：按单号跳转运单详情查看垂直时间轴。
 */
export default function CustomerTrackingPage() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [recent, setRecent] = useState<Row[]>([]);
  const [hint, setHint] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);

  /**
   * 拉取最近运单号便于快捷跳转。
   */
  const loadRecent = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/client/shipments", {
        credentials: "include",
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        list?: { id: string; trackingNumber: string }[];
      };
      setRecent((data.list ?? []).slice(0, 8));
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  /**
   * 在本人运单列表中匹配单号并进入详情页。
   */
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    setHint("");
    const q = trackingNumber.trim();
    if (!q) {
      return;
    }
    setSearching(true);
    try {
      const response = await fetch("/api/client/shipments", {
        credentials: "include",
      });
      if (!response.ok) {
        setHint("请重新登录后重试。");
        return;
      }
      const data = (await response.json()) as { list?: Row[] };
      const list = data.list ?? [];
      const hit = list.find(
        (r) =>
          r.trackingNumber === q ||
          r.trackingNumber.toLowerCase() === q.toLowerCase()
      );
      if (hit) {
        router.push(`/customer/shipments/${hit.id}`);
        return;
      }
      setHint("未找到该单号。请核对后重试，或先在「我的运单」中确认。");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-10">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-2">
          <MapPin className="h-7 w-7 text-[#1677ff]" />
          <h1 className="text-base font-semibold text-[rgba(0,0,0,0.88)]">
            物流轨迹
          </h1>
        </div>
        <p className="mb-4 text-xs text-[rgba(0,0,0,0.45)]">
          输入预录单号（YB
          开头）将打开运单详情页查看物流进度时间轴；也可从下方最近单号直接跳转。
        </p>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="rounded-lg border border-[#d9d9d9] bg-white p-4 shadow-sm"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-[rgba(0,0,0,0.45)]">预录单号</span>
            <input
              type="text"
              value={trackingNumber}
              onChange={(event) => {
                setTrackingNumber(event.target.value);
              }}
              placeholder="例如 YBXTYW202604120001"
              className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-sm outline-none focus:border-[#1677ff]"
            />
          </label>
          {hint ? (
            <p className="mt-2 text-xs text-amber-700">{hint}</p>
          ) : null}
          <button
            type="submit"
            disabled={searching}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-[#1677ff] py-2.5 text-sm font-medium text-white hover:bg-[#4096ff] disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {searching ? "查询中…" : "查询并查看轨迹"}
          </button>
        </form>

        {recent.length > 0 ? (
          <div className="mt-6 rounded-lg border border-[#d9d9d9] bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-[rgba(0,0,0,0.65)]">
              最近运单
            </p>
            <ul className="space-y-2 text-sm">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/customer/shipments/${encodeURIComponent(r.id)}`}
                    className="font-mono text-[#1677ff] hover:underline"
                  >
                    {r.trackingNumber}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
