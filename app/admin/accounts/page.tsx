"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Search,
  ShieldOff,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";

type UserRow = {
  id: string;
  username: string;
  role: "STAFF" | "CLIENT";
  createdAt: string;
  isBanned: boolean;
  totalVolume?: number;
  totalOrders?: number;
  discountRate?: number | null;
  specialSeaPrice?: number | null;
  specialLandPrice?: number | null;
};

type PasswordFieldRowProps = {
  inputId: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: string;
};

/**
 * 带显示/隐藏切换的密码输入行。
 */
function PasswordFieldRow({
  inputId,
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  autoComplete,
}: PasswordFieldRowProps) {
  return (
    <div className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <div className="relative">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-slate-300 py-2 pl-3 pr-10 outline-none ring-brand/20 focus:ring"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          onClick={onToggleShow}
          aria-label={show ? "隐藏密码" : "显示密码"}
        >
          {show ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * 账号管理：统一维护仓库员工与客户登录账号，列表展示全部非管理员账号。
 */
export default function AdminAccountsPage() {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordConfirm, setPasswordConfirm] = useState<string>("");
  const [showCreatePwd, setShowCreatePwd] = useState<boolean>(false);
  const [showCreatePwd2, setShowCreatePwd2] = useState<boolean>(false);
  const [realName, setRealName] = useState<string>("");
  const [role, setRole] = useState<"STAFF" | "CLIENT">("STAFF");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [list, setList] = useState<UserRow[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [accountSearch, setAccountSearch] = useState<string>("");
  const [passwordModalFor, setPasswordModalFor] = useState<UserRow | null>(
    null
  );
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showModalPwd, setShowModalPwd] = useState<boolean>(false);
  const [showModalPwd2, setShowModalPwd2] = useState<boolean>(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>("");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [pricingDraft, setPricingDraft] = useState<
    Record<string, { discountRate: string; specialSeaPrice: string; specialLandPrice: string }>
  >({});

  /**
   * 按账号关键字过滤列表（不区分大小写）。
   */
  const filteredList = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((row) => row.username.toLowerCase().includes(q));
  }, [list, accountSearch]);

  /**
   * 拉取员工与客户账号列表。
   */
  const loadUsers = useCallback(async (): Promise<void> => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/admin/users", { credentials: "include" });
      const data = (await response.json()) as { list?: UserRow[] };
      if (response.ok && data.list) {
        setList(data.list);
        setPricingDraft(
          Object.fromEntries(
            data.list.map((row) => [
              row.id,
              {
                discountRate:
                  row.discountRate === null || row.discountRate === undefined
                    ? ""
                    : String(row.discountRate),
                specialSeaPrice:
                  row.specialSeaPrice === null || row.specialSeaPrice === undefined
                    ? ""
                    : String(row.specialSeaPrice),
                specialLandPrice:
                  row.specialLandPrice === null || row.specialLandPrice === undefined
                    ? ""
                    : String(row.specialLandPrice),
              },
            ])
          )
        );
      }
    } catch {
      setList([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  /**
   * 提交创建账号请求。
   */
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    if (password !== passwordConfirm) {
      setError("两次输入的密码不一致");
      setSubmitting(false);
      return;
    }
    try {
      const body: Record<string, unknown> = { username, password, role };
      if (role === "CLIENT") {
        body.realName = realName.trim() || null;
      }
      const response = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        message?: string;
        detail?: string;
      };
      if (!response.ok) {
        setError(
          data.detail
            ? `${data.message ?? "创建失败"}（${data.detail}）`
            : (data.message ?? "创建失败")
        );
        return;
      }
      setMessage(data.message ?? "创建成功");
      setUsername("");
      setPassword("");
      setPasswordConfirm("");
      setRealName("");
      setRole("STAFF");
      await loadUsers();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 将角色枚举转为中文展示。
   */
  function roleLabel(r: UserRow["role"]): string {
    return r === "STAFF" ? "仓库员工" : "客户";
  }

  /**
   * 切换账号封禁状态。
   */
  async function handleToggleBan(row: UserRow): Promise<void> {
    setActionUserId(row.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned: !row.isBanned }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "操作失败");
        return;
      }
      await loadUsers();
    } catch {
      setError("网络异常");
    } finally {
      setActionUserId(null);
    }
  }

  /**
   * 提交管理员重置密码。
   */
  async function handleSubmitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordModalFor) {
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("两次输入的密码不一致");
      return;
    }
    setPasswordSubmitting(true);
    setPasswordError("");
    try {
      const response = await fetch(`/api/admin/users/${passwordModalFor.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setPasswordError(data.message ?? "修改失败");
        return;
      }
      setPasswordModalFor(null);
      setNewPassword("");
      setConfirmPassword("");
      setMessage(data.message ?? "密码已更新");
      await loadUsers();
    } catch {
      setPasswordError("网络异常");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  /**
   * 关闭改密弹层并清空输入。
   */
  function closePasswordModal(): void {
    setPasswordModalFor(null);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setShowModalPwd(false);
    setShowModalPwd2(false);
  }

  /**
   * 保存客户专属折扣与专属单价。
   */
  async function handleSavePricing(row: UserRow): Promise<void> {
    const draft = pricingDraft[row.id];
    if (!draft || row.role !== "CLIENT") {
      return;
    }
    setActionUserId(row.id);
    setError("");
    try {
      const payload = {
        discountRate: draft.discountRate.trim() ? Number.parseFloat(draft.discountRate) : null,
        specialSeaPrice: draft.specialSeaPrice.trim() ? Number.parseFloat(draft.specialSeaPrice) : null,
        specialLandPrice: draft.specialLandPrice.trim() ? Number.parseFloat(draft.specialLandPrice) : null,
      };
      const response = await fetch(`/api/admin/users/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "保存失败");
        return;
      }
      setMessage("客户专属价格策略已更新");
      await loadUsers();
    } catch {
      setError("网络异常");
    } finally {
      setActionUserId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Users className="h-7 w-7 text-brand" />
        <h1 className="text-xl font-semibold text-brand">账号管理</h1>
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-brand" />
          <h2 className="text-base font-semibold text-slate-900">创建账号</h2>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          可新建<strong>仓库员工</strong>或<strong>客户</strong>登录账号。管理员账号请通过系统初始化或数据库维护，不在此创建。
        </p>
        <form onSubmit={handleCreate} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">登录账号</span>
            <input
              type="text"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="英文字母或数字等"
            />
          </label>
          <PasswordFieldRow
            inputId="create-password"
            label="初始密码"
            value={password}
            onChange={setPassword}
            placeholder="至少 6 位"
            show={showCreatePwd}
            onToggleShow={() => setShowCreatePwd((v) => !v)}
            autoComplete="new-password"
          />
          <PasswordFieldRow
            inputId="create-password-confirm"
            label="确认密码"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            placeholder="请再次输入密码"
            show={showCreatePwd2}
            onToggleShow={() => setShowCreatePwd2((v) => !v)}
            autoComplete="new-password"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">角色</span>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
              value={role}
              onChange={(e) => setRole(e.target.value as "STAFF" | "CLIENT")}
            >
              <option value="STAFF">仓库员工（员工端）</option>
              <option value="CLIENT">客户（客户端）</option>
            </select>
          </label>
          {role === "CLIENT" ? (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">
                客户真实姓名（可选）
              </span>
              <input
                type="text"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand/20 focus:ring"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="仅客户端可见，可不填"
                maxLength={50}
              />
            </label>
          ) : null}
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
          {message ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white disabled:bg-slate-300"
          >
            {submitting ? "提交中…" : "创建账号"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          全部账号
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          下列为系统中全部仓库员工与客户登录账号（不含管理员）。
        </p>
        <div className="mb-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">搜索账号</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-brand/20 focus:ring"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="按登录账号筛选"
                autoComplete="off"
              />
            </div>
          </label>
        </div>
        {loadingList ? (
          <p className="text-sm text-slate-500">加载中…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-500">暂无账号，请在上方创建。</p>
        ) : filteredList.length === 0 ? (
          <p className="text-sm text-slate-500">
            无匹配账号，请调整搜索关键字。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-3 font-medium">账号</th>
                  <th className="py-2 pr-3 font-medium">角色</th>
                  <th className="py-2 pr-3 font-medium">总货量 / 单量</th>
                  <th className="py-2 pr-3 font-medium">专属价格策略</th>
                  <th className="py-2 pr-3 font-medium">状态</th>
                  <th className="py-2 pr-3 font-medium">创建时间</th>
                  <th className="py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      {row.username}
                    </td>
                    <td className="py-2 pr-3">{roleLabel(row.role)}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {row.role === "CLIENT"
                        ? `${(row.totalVolume ?? 0).toFixed(3)} CBM / ${row.totalOrders ?? 0} 单`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {row.role === "CLIENT" ? (
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            value={pricingDraft[row.id]?.discountRate ?? ""}
                            onChange={(e) =>
                              setPricingDraft((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...(prev[row.id] ?? {
                                    discountRate: "",
                                    specialSeaPrice: "",
                                    specialLandPrice: "",
                                  }),
                                  discountRate: e.target.value,
                                },
                              }))
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                            placeholder="折扣率"
                          />
                          <input
                            value={pricingDraft[row.id]?.specialSeaPrice ?? ""}
                            onChange={(e) =>
                              setPricingDraft((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...(prev[row.id] ?? {
                                    discountRate: "",
                                    specialSeaPrice: "",
                                    specialLandPrice: "",
                                  }),
                                  specialSeaPrice: e.target.value,
                                },
                              }))
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                            placeholder="海运专属价"
                          />
                          <input
                            value={pricingDraft[row.id]?.specialLandPrice ?? ""}
                            onChange={(e) =>
                              setPricingDraft((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...(prev[row.id] ?? {
                                    discountRate: "",
                                    specialSeaPrice: "",
                                    specialLandPrice: "",
                                  }),
                                  specialLandPrice: e.target.value,
                                },
                              }))
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                            placeholder="陆运专属价"
                          />
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {row.isBanned ? (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          已封禁
                        </span>
                      ) : (
                        <span className="text-slate-600">正常</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {new Date(row.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setPasswordModalFor(row);
                            setNewPassword("");
                            setConfirmPassword("");
                            setPasswordError("");
                            setShowModalPwd(false);
                            setShowModalPwd2(false);
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          修改密码
                        </button>
                        <button
                          type="button"
                          disabled={actionUserId === row.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          onClick={() => {
                            void handleToggleBan(row);
                          }}
                        >
                          {row.isBanned ? (
                            <>
                              <ShieldOff className="h-3.5 w-3.5" />
                              解除封禁
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="h-3.5 w-3.5" />
                              封禁
                            </>
                          )}
                        </button>
                        {row.role === "CLIENT" ? (
                          <button
                            type="button"
                            disabled={actionUserId === row.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-brand/30 px-2 py-1 text-xs font-medium text-brand disabled:opacity-50"
                            onClick={() => {
                              void handleSavePricing(row);
                            }}
                          >
                            保存价格策略
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-500">
        客户合同、结算方式等档案类功能可在后续「客户档案」模块扩展；当前登录账号统一在本页维护。
      </p>

      {passwordModalFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwd-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3
              id="pwd-dialog-title"
              className="mb-1 text-base font-semibold text-slate-900"
            >
              修改密码
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              账号「{passwordModalFor.username}」将使用下方新密码登录。
            </p>
            <form onSubmit={handleSubmitPasswordReset} className="space-y-3">
              <PasswordFieldRow
                inputId="modal-new-password"
                label="新密码"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="至少 6 位"
                show={showModalPwd}
                onToggleShow={() => setShowModalPwd((v) => !v)}
                autoComplete="new-password"
              />
              <PasswordFieldRow
                inputId="modal-confirm-password"
                label="确认新密码"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="再次输入"
                show={showModalPwd2}
                onToggleShow={() => setShowModalPwd2((v) => !v)}
                autoComplete="new-password"
              />
              {passwordError ? (
                <p className="text-sm text-red-600">{passwordError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={closePasswordModal}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                >
                  {passwordSubmitting ? "提交中…" : "确认修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
