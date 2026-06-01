"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Copy,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { buildAIHeaders, getPreferredProvider } from "@/lib/api-keys";
import type { AIProvider } from "@/lib/ai";

export interface DraftContent {
  draft: string;
  keywords: string[];
}
export interface BehaviorRow {
  id: string;
  number: number;
  name: string;
  submitted: boolean;
  report: {
    id: string;
    content: DraftContent;
    length: string;
    generatedAt: string;
  } | null;
}

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type Length = "brief" | "standard" | "detailed";

const LENGTH_OPTIONS: { value: Length; label: string }[] = [
  { value: "brief", label: "간략" },
  { value: "standard", label: "표준" },
  { value: "detailed", label: "상세" },
];

export function BehaviorManager({
  assignmentId,
  students,
}: {
  assignmentId: string;
  students: BehaviorRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>(() =>
    typeof window === "undefined" ? "gemini" : getPreferredProvider()
  );
  const [length, setLength] = useState<Length>("standard");

  // SSR 행 + 생성/갱신 결과를 합쳐 표시
  const [reports, setReports] = useState<Record<string, BehaviorRow["report"]>>(() => {
    const init: Record<string, BehaviorRow["report"]> = {};
    for (const s of students) init[s.id] = s.report;
    return init;
  });

  const submittedCount = students.filter((s) => s.submitted).length;
  const doneCount = students.filter((s) => reports[s.id]).length;

  async function generate(studentId: string) {
    setBusyId(studentId);
    setError(null);
    try {
      const res = await fetch("/api/reports/behavior", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAIHeaders(provider),
        },
        body: JSON.stringify({ studentId, assignmentId, length, provider }),
      });
      const json: ApiResp<{
        id: string;
        content: DraftContent;
        length: string;
        generatedAt: string;
      }> = await res.json();
      if (!json.success || !json.data) {
        setError(json.error || "초안 생성에 실패했습니다.");
        return;
      }
      setReports((prev) => ({
        ...prev,
        [studentId]: {
          id: json.data!.id,
          content: json.data!.content,
          length: json.data!.length,
          generatedAt: json.data!.generatedAt,
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(reportId: string, studentId: string) {
    if (!window.confirm("이 초안을 삭제할까요?")) return;
    setBusyId(studentId);
    setError(null);
    try {
      const res = await fetch(`/api/reports/behavior/${reportId}`, {
        method: "DELETE",
      });
      const json: ApiResp<unknown> = await res.json();
      if (!json.success) {
        setError(json.error || "삭제에 실패했습니다.");
        return;
      }
      setReports((prev) => ({ ...prev, [studentId]: null }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
    }
  }

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      setError("복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  }

  return (
    <div>
      {/* AI 제공자 + 길이 옵션 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Sparkles className="h-4 w-4 text-teal" />
          AI 제공자
          <div className="ml-1 flex items-center gap-1.5">
            {(["gemini", "claude"] as AIProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                  provider === p
                    ? "border-teal bg-teal-50 text-teal-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p === "gemini" ? "Gemini" : "Claude"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          분량
          <div className="flex items-center gap-1.5">
            {LENGTH_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setLength(o.value)}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                  length === o.value
                    ? "border-teal bg-teal-50 text-teal-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {students.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500">
          학생이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {students.map((s) => {
            const report = reports[s.id];
            const isBusy = busyId === s.id;
            return (
              <li
                key={s.id}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                      {s.number}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500">
                        {s.submitted ? "학기말 글쓰기 제출함" : "미제출"}
                        {report && (
                          <>
                            {" · "}
                            <span className="text-teal-700">초안 생성됨</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {report && (
                      <button
                        onClick={() => remove(report.id, s.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        삭제
                      </button>
                    )}
                    <button
                      onClick={() => generate(s.id)}
                      disabled={!s.submitted || isBusy}
                      title={!s.submitted ? "학생이 제출해야 생성할 수 있어요." : ""}
                      className="inline-flex items-center gap-1.5 rounded-md bg-teal px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isBusy ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          생성 중...
                        </>
                      ) : report ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5" />
                          재생성
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          생성
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 초안 인라인 표시 */}
                {report && (
                  <div className="mt-3 rounded-lg border border-gray-100 bg-bg-subtle p-3">
                    {report.content.keywords.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {report.content.keywords.map((k, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                      {report.content.draft}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {[...report.content.draft].length}자 ·{" "}
                        {new Date(report.generatedAt).toLocaleDateString("ko-KR")}
                      </span>
                      <button
                        onClick={() => copy(report.id, report.content.draft)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {copiedId === report.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-teal-600" />
                            복사됨
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            복사
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-gray-500">
        제출 {submittedCount}명 · 초안 {doneCount}명 생성됨. 초안은 학생에게 보이지
        않으며, 교사용 자료입니다.
      </p>
    </div>
  );
}
