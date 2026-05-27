"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, RefreshCw } from "lucide-react";

interface InviteCode {
  id: string;
  code: string;
  isActive: boolean;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  teacher: { email: string; name: string } | null;
}

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function AdminInviteCodes() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [count, setCount] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/invite-codes");
    const body: ApiResp<InviteCode[]> = await res.json();
    if (body.success && body.data) setCodes(body.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const res = await fetch("/api/admin/invite-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count, expiresInDays }),
    });
    const body: ApiResp<InviteCode[]> = await res.json();
    setCreating(false);
    if (!body.success) {
      setError(body.error || "초대코드 발급에 실패했습니다.");
      return;
    }
    await load();
  }

  function copy(code: string) {
    void navigator.clipboard.writeText(code);
  }

  function statusOf(c: InviteCode): { label: string; tone: string } {
    if (c.usedAt) return { label: "사용됨", tone: "bg-gray-100 text-gray-600" };
    if (new Date(c.expiresAt).getTime() < Date.now())
      return { label: "만료", tone: "bg-amber-50 text-amber-700" };
    if (!c.isActive) return { label: "비활성", tone: "bg-gray-100 text-gray-600" };
    return { label: "사용 가능", tone: "bg-teal-50 text-teal-700" };
  }

  return (
    <div className="space-y-6">
      {/* 발급 폼 */}
      <section className="card">
        <h2 className="mb-4 font-semibold text-gray-900">초대코드 발급</h2>
        <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">발급 개수</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="input"
            />
          </div>
          <div>
            <label className="label">유효 기간 (일)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full py-2.5" disabled={creating}>
              <Plus className="h-4 w-4" />
              {creating ? "발급 중..." : "발급하기"}
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </section>

      {/* 목록 */}
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">최근 발급 내역</h2>
          <button onClick={() => void load()} className="btn-secondary text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : codes.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            발급된 초대코드가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2">코드</th>
                  <th className="px-2 py-2">상태</th>
                  <th className="px-2 py-2">사용자</th>
                  <th className="px-2 py-2">만료</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => {
                  const s = statusOf(c);
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-2 py-3 font-mono tracking-wider">{c.code}</td>
                      <td className="px-2 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.tone}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-gray-600">
                        {c.teacher ? `${c.teacher.name} (${c.teacher.email})` : "—"}
                      </td>
                      <td className="px-2 py-3 text-gray-500">
                        {new Date(c.expiresAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => copy(c.code)}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                          title="복사"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
