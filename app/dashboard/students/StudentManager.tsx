"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Copy, Pencil, Plus, Trash2, Upload, X, Check } from "lucide-react";

interface Student {
  id: string;
  number: number;
  name: string;
  classId: string;
  createdAt: string;
}

interface ClassInfo {
  id: string;
  name: string;
  year: number;
  classCode: string;
}

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type Mode = "single" | "bulk";

export function StudentManager({
  cls,
  initialStudents,
}: {
  cls: ClassInfo;
  initialStudents: Student[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [mode, setMode] = useState<Mode>("single");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ── 단건 추가 ──
  const [singleNumber, setSingleNumber] = useState<number>(
    nextAvailableNumber(students)
  );
  const [singleName, setSingleName] = useState("");
  const [singlePin, setSinglePin] = useState("");

  // ── 일괄 추가 ──
  const [bulkText, setBulkText] = useState("");

  // ── 편집 상태 ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ number: number; name: string; pin: string }>({
    number: 0,
    name: "",
    pin: "",
  });

  async function refreshList() {
    const res = await fetch(`/api/students?classId=${cls.id}`);
    const body: ApiResp<Student[]> = await res.json();
    if (body.success && body.data) setStudents(body.data);
  }

  async function onAddSingle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId: cls.id,
        number: singleNumber,
        name: singleName,
        pin: singlePin || null,
      }),
    });
    const body: ApiResp<Student> = await res.json();
    if (!body.success || !body.data) {
      setError(body.error || "추가 실패");
      return;
    }
    const created = body.data;
    setStudents((s) => [...s, created].sort((a, b) => a.number - b.number));
    setSingleName("");
    setSinglePin("");
    setSingleNumber(nextAvailableNumber([...students, created]));
    router.refresh();
  }

  async function onAddBulk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const parsed = parseBulkText(bulkText);
    if (parsed.errors.length > 0) {
      setError(parsed.errors.join(" / "));
      return;
    }
    if (parsed.rows.length === 0) {
      setError("추가할 학생이 없습니다.");
      return;
    }

    const res = await fetch("/api/students", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ classId: cls.id, students: parsed.rows }),
    });
    const body: ApiResp<{
      createdCount: number;
      skippedCount: number;
      skippedNumbers: number[];
    }> = await res.json();
    if (!body.success || !body.data) {
      setError(body.error || "일괄 추가 실패");
      return;
    }
    setBulkText("");
    setInfo(
      body.data.skippedCount > 0
        ? `${body.data.createdCount}명 추가, ${body.data.skippedCount}명은 이미 존재(번호 ${body.data.skippedNumbers.join(", ")})`
        : `${body.data.createdCount}명 추가되었습니다.`
    );
    await refreshList();
    router.refresh();
  }

  function startEdit(s: Student) {
    setEditingId(s.id);
    setEditForm({ number: s.number, name: s.name, pin: "" });
  }

  async function onSaveEdit(id: string) {
    setError(null);
    const res = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        number: editForm.number,
        name: editForm.name,
        // 빈 문자열이면 PIN 변경 안 함, 명시적으로 null로 비우려면 별도 처리
        ...(editForm.pin ? { pin: editForm.pin } : {}),
      }),
    });
    const body: ApiResp<Student> = await res.json();
    if (!body.success || !body.data) {
      setError(body.error || "수정 실패");
      return;
    }
    setStudents((arr) =>
      arr.map((s) => (s.id === id ? { ...s, ...body.data! } : s)).sort((a, b) => a.number - b.number)
    );
    setEditingId(null);
  }

  async function onDelete(s: Student) {
    if (!confirm(`${s.number}번 ${s.name} 학생을 삭제할까요? 제출물도 모두 삭제됩니다.`))
      return;
    const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
    const body: ApiResp<unknown> = await res.json();
    if (!body.success) {
      alert(body.error || "삭제 실패");
      return;
    }
    setStudents((arr) => arr.filter((x) => x.id !== s.id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* 학급 헤더 */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">
            {cls.year}년 · 학생 {students.length}명
          </p>
          <h2 className="text-lg font-bold text-gray-900">{cls.name}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-bg-subtle px-3 py-2 text-sm">
          <span className="text-gray-500">학급코드:</span>
          <span className="font-mono font-semibold text-gray-900">{cls.classCode}</span>
          <button
            onClick={() => navigator.clipboard.writeText(cls.classCode)}
            className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700"
            title="복사"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 추가 모드 토글 */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("single")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            mode === "single"
              ? "bg-teal text-white"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
          }`}
        >
          한 명씩 추가
        </button>
        <button
          onClick={() => setMode("bulk")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            mode === "bulk"
              ? "bg-teal text-white"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
          }`}
        >
          여러 명 한 번에
        </button>
      </div>

      {/* 단건 추가 */}
      {mode === "single" ? (
        <form onSubmit={onAddSingle} className="card">
          <div className="grid gap-3 sm:grid-cols-[100px_1fr_120px_auto]">
            <input
              required
              type="number"
              min={1}
              max={99}
              value={singleNumber}
              onChange={(e) => setSingleNumber(Number(e.target.value))}
              className="input"
              placeholder="번호"
            />
            <input
              required
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              className="input"
              placeholder="이름"
            />
            <input
              value={singlePin}
              onChange={(e) => setSinglePin(e.target.value.replace(/\D/g, ""))}
              className="input"
              placeholder="PIN (숫자, 선택)"
              maxLength={10}
            />
            <button type="submit" className="btn-primary">
              <Plus className="h-4 w-4" />
              추가
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onAddBulk} className="card">
          <p className="mb-2 text-sm text-gray-700">
            한 줄에 한 명씩 입력하세요. 형식:{" "}
            <code className="rounded bg-gray-100 px-1 text-xs">번호, 이름, PIN(선택)</code>
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="input min-h-[160px] font-mono text-sm"
            placeholder={`1, 김민준\n2, 이서연, 1234\n3, 박지호`}
          />
          <div className="mt-3 flex justify-end">
            <button type="submit" className="btn-primary">
              <Upload className="h-4 w-4" />
              일괄 추가
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {info && (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-700">{info}</p>
      )}

      {/* 학생 목록 */}
      {students.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
          아직 학생이 없습니다. 위에서 학생을 추가하세요.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-20 px-4 py-2.5">번호</th>
                <th className="px-4 py-2.5">이름</th>
                <th className="w-40 px-4 py-2.5">PIN</th>
                <th className="w-32 px-4 py-2.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const editing = editingId === s.id;
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {editing ? (
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={editForm.number}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, number: Number(e.target.value) }))
                          }
                          className="input py-1"
                        />
                      ) : (
                        s.number
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {editing ? (
                        <input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, name: e.target.value }))
                          }
                          className="input py-1"
                        />
                      ) : (
                        <Link
                          href={`/dashboard/students/${s.id}`}
                          className="inline-flex items-center gap-1 text-gray-900 hover:text-teal-700 hover:underline"
                        >
                          {s.name}
                          <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {editing ? (
                        <input
                          value={editForm.pin}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              pin: e.target.value.replace(/\D/g, ""),
                            }))
                          }
                          placeholder="새 PIN (비우면 유지)"
                          className="input py-1"
                          maxLength={10}
                        />
                      ) : (
                        <span className="text-xs">●●●●</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editing ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => onSaveEdit(s.id)}
                            className="rounded p-1.5 text-teal-700 hover:bg-teal-50"
                            title="저장"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                            title="취소"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => startEdit(s)}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                            title="수정"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDelete(s)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 헬퍼 ──

function nextAvailableNumber(students: Student[]): number {
  if (students.length === 0) return 1;
  const used = new Set(students.map((s) => s.number));
  for (let i = 1; i <= 99; i++) if (!used.has(i)) return i;
  return 1;
}

interface BulkRow {
  number: number;
  name: string;
  pin?: string | null;
}

function parseBulkText(text: string): { rows: BulkRow[]; errors: string[] } {
  const rows: BulkRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    if (parts.length < 2) {
      errors.push(`${i + 1}행: "번호, 이름" 형식이 필요합니다.`);
      return;
    }
    const num = Number(parts[0]);
    if (!Number.isInteger(num) || num < 1 || num > 99) {
      errors.push(`${i + 1}행: 번호는 1~99 사이의 정수여야 합니다.`);
      return;
    }
    const name = parts[1];
    if (!name) {
      errors.push(`${i + 1}행: 이름이 비어 있습니다.`);
      return;
    }
    const pin = parts[2] || undefined;
    if (pin && !/^\d+$/.test(pin)) {
      errors.push(`${i + 1}행: PIN은 숫자만 가능합니다.`);
      return;
    }
    rows.push({ number: num, name, pin: pin ?? null });
  });
  return { rows, errors };
}
