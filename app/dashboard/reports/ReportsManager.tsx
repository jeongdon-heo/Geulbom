"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { buildAIHeaders, getPreferredProvider } from "@/lib/api-keys";
import type { AIProvider } from "@/lib/ai";

interface StudentRow {
  id: string;
  number: number;
  name: string;
  approvedCount: number;
  report: { id: string; generatedAt: string } | null;
}

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function ReportsManager({
  classId,
  year,
  students,
}: {
  classId: string;
  year: number;
  students: StudentRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>(() =>
    typeof window === "undefined" ? "gemini" : getPreferredProvider()
  );

  async function generate(studentId: string) {
    setBusyId(studentId);
    setError(null);
    try {
      const res = await fetch("/api/reports/yearend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAIHeaders(provider),
        },
        body: JSON.stringify({ studentId, provider }),
      });
      const json: ApiResp<{ id: string }> = await res.json();
      if (!json.success || !json.data) {
        setError(json.error || "보고서 생성에 실패했습니다.");
        return;
      }
      // 생성 성공 → 상세 페이지로 이동
      router.push(`/dashboard/reports/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* AI 제공자 선택 */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Sparkles className="h-4 w-4 text-teal" />
          AI 제공자
        </div>
        <div className="flex items-center gap-1.5">
          {(["gemini", "claude"] as AIProvider[]).map((p) => {
            const active = provider === p;
            return (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-teal bg-teal-50 text-teal-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p === "gemini" ? "Gemini" : "Claude"}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* 학생 목록 */}
      {students.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500">
          학생이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {students.map((s) => {
            const canGenerate = s.approvedCount >= 2;
            const isBusy = busyId === s.id;
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                    {s.number}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {s.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      승인된 글 {s.approvedCount}편
                      {s.report && (
                        <>
                          {" · "}
                          <span className="inline-flex items-center gap-1 text-teal-700">
                            <CheckCircle2 className="h-3 w-3" />
                            보고서 생성됨 (
                            {new Date(s.report.generatedAt).toLocaleDateString(
                              "ko-KR",
                              {
                                year: "2-digit",
                                month: "long",
                                day: "numeric",
                              }
                            )}
                            )
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {s.report && (
                    <Link
                      href={`/dashboard/reports/${s.report.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      보기
                    </Link>
                  )}
                  <button
                    onClick={() => generate(s.id)}
                    disabled={!canGenerate || isBusy}
                    title={
                      !canGenerate ? "승인된 글이 최소 2편 있어야 합니다." : ""
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {isBusy ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        생성 중...
                      </>
                    ) : s.report ? (
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
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-gray-500">
        {year}년 학급 기준. 각 학생의 승인된 글이 최소 2편이어야 학년말 보고서를
        생성할 수 있어요. 보고서는 학생×연도 단위로 1개만 저장됩니다.
      </p>
    </div>
  );
}
