"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2, Users } from "lucide-react";

interface ClassRow {
  id: string;
  name: string;
  year: number;
  classCode: string;
  studentCount: number;
  createdAt: string;
}

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function ClassManager({ initialClasses }: { initialClasses: ClassRow[] }) {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>(initialClasses);
  const [name, setName] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, year }),
      });
      const body: ApiResp<{
        id: string;
        name: string;
        year: number;
        classCode: string;
        createdAt: string;
      }> = await res.json();
      if (!body.success || !body.data) {
        setError(body.error || "학급 생성에 실패했습니다.");
        return;
      }
      setClasses((cs) => [
        {
          id: body.data!.id,
          name: body.data!.name,
          year: body.data!.year,
          classCode: body.data!.classCode,
          studentCount: 0,
          createdAt: body.data!.createdAt,
        },
        ...cs,
      ]);
      setName("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`"${name}" 학급을 삭제할까요? 학생/과제/제출물도 함께 삭제됩니다.`))
      return;
    const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
    const body: ApiResp<unknown> = await res.json();
    if (!body.success) {
      alert(body.error || "삭제 실패");
      return;
    }
    setClasses((cs) => cs.filter((c) => c.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* 생성 폼 */}
      <form onSubmit={onCreate} className="card">
        <h3 className="mb-3 font-semibold text-gray-900">새 학급 만들기</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="4학년 2반"
          />
          <input
            required
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input"
            placeholder="연도"
          />
          <button type="submit" className="btn-primary" disabled={creating}>
            <Plus className="h-4 w-4" />
            {creating ? "생성 중..." : "추가"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>

      {/* 목록 */}
      {classes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
          아직 학급이 없습니다. 위 폼에서 첫 학급을 만들어보세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {classes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.year}년</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    학생 {c.studentCount}명
                  </span>
                  <span className="inline-flex items-center gap-2 font-mono">
                    학급코드: <span className="text-gray-900">{c.classCode}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(c.classCode)}
                      title="학급코드 복사"
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              </div>
              <button
                onClick={() => onDelete(c.id, c.name)}
                className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="학급 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
