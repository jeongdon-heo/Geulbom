"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { buildAIHeaders, getPreferredProvider } from "@/lib/api-keys";
import type { AIProvider } from "@/lib/ai";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// AI 분석 대기 상태인 제출들을 한 번에(순차로) 분석하는 버튼.
// 서버 API(/api/analyze/feedback)는 제출 1건만 처리하고 API 키도
// 브라우저에만 있으므로, 클라이언트에서 제출 ID를 하나씩 호출합니다.
export default function BatchAnalyzeButton({
  submissionIds,
}: {
  submissionIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<number>(0);
  const total = submissionIds.length;

  if (total === 0) return null;

  async function runBatch() {
    if (!confirm(`AI 분석 대기 중인 ${total}건을 모두 분석합니다. 진행할까요?`))
      return;
    setBusy(true);
    setDone(0);
    setFailed(0);
    const provider: AIProvider = getPreferredProvider();
    const headers = { "content-type": "application/json", ...buildAIHeaders(provider) };

    let okCount = 0;
    let failCount = 0;
    // 순차 처리 — 레이트리밋 회피 + 실패 추적 용이
    for (const submissionId of submissionIds) {
      try {
        const res = await fetch("/api/analyze/feedback", {
          method: "POST",
          headers,
          body: JSON.stringify({ submissionId, provider }),
        });
        const body: ApiResp<unknown> = await res.json();
        if (body.success) okCount++;
        else failCount++;
      } catch {
        failCount++;
      }
      setDone(okCount + failCount);
      setFailed(failCount);
    }

    setBusy(false);
    if (failCount > 0) {
      alert(
        `분석 완료: 성공 ${okCount}건, 실패 ${failCount}건.\n실패한 글은 개별 화면에서 다시 시도해 주세요.`,
      );
    }
    router.refresh();
  }

  return (
    <button
      onClick={runBatch}
      disabled={busy}
      className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          분석 중… {done}/{total}
          {failed > 0 && (
            <span className="text-xs font-normal">(실패 {failed})</span>
          )}
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          분석 대기 {total}건 모두 분석
        </>
      )}
    </button>
  );
}
