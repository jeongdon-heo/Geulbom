"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { buildAIHeaders, getPreferredProvider } from "@/lib/api-keys";
import type { AIProvider } from "@/lib/ai";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function ReportActions({
  reportId,
  studentId,
}: {
  reportId: string;
  studentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"none" | "regen" | "delete">("none");
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>(() =>
    typeof window === "undefined" ? "gemini" : getPreferredProvider()
  );

  async function regenerate() {
    setBusy("regen");
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
        setError(json.error || "재생성에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy("none");
    }
  }

  async function remove() {
    if (!window.confirm("이 보고서를 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/reports/yearend/${reportId}`, {
        method: "DELETE",
      });
      const json: ApiResp<unknown> = await res.json();
      if (!json.success) {
        setError(json.error || "삭제에 실패했습니다.");
        return;
      }
      router.push("/dashboard/reports");
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy("none");
    }
  }

  function print() {
    window.print();
  }

  return (
    <div className="report-actions">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2 no-print">
        <div className="mr-auto flex items-center gap-1.5 text-xs text-gray-500">
          AI:
          {(["gemini", "claude"] as AIProvider[]).map((p) => {
            const active = provider === p;
            return (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`rounded border px-2 py-0.5 text-xs font-medium transition ${
                  active
                    ? "border-teal bg-teal-50 text-teal-700"
                    : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {p === "gemini" ? "Gemini" : "Claude"}
              </button>
            );
          })}
        </div>
        <button
          onClick={print}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" />
          인쇄 / PDF 저장
        </button>
        <button
          onClick={regenerate}
          disabled={busy !== "none"}
          className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${busy === "regen" ? "animate-spin" : ""}`}
          />
          {busy === "regen" ? "재생성 중..." : "AI 재생성"}
        </button>
        <button
          onClick={remove}
          disabled={busy !== "none"}
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          삭제
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 no-print">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
