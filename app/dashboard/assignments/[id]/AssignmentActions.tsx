"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Trash2 } from "lucide-react";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function AssignmentActions({
  assignmentId,
  isActive,
  autoApprove,
  showScoreToStudent,
}: {
  assignmentId: string;
  isActive: boolean;
  autoApprove: boolean;
  showScoreToStudent: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // 로컬 상태로 즉시 반영
  const [active, setActive] = useState(isActive);
  const [auto, setAuto] = useState(autoApprove);
  const [showScore, setShowScore] = useState(showScoreToStudent);

  async function patch(patch: Record<string, boolean>) {
    setBusy(true);
    const res = await fetch(`/api/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body: ApiResp<unknown> = await res.json();
    setBusy(false);
    if (!body.success) {
      alert(body.error || "변경 실패");
      return false;
    }
    router.refresh();
    return true;
  }

  async function onToggleActive() {
    const next = !active;
    if (await patch({ isActive: next })) setActive(next);
  }

  async function onToggleAuto() {
    const next = !auto;
    if (await patch({ autoApprove: next })) setAuto(next);
  }

  async function onToggleShowScore() {
    const next = !showScore;
    if (await patch({ showScoreToStudent: next })) setShowScore(next);
  }

  async function onDelete() {
    if (!confirm("이 과제와 모든 회차/제출/피드백을 삭제할까요? 되돌릴 수 없습니다."))
      return;
    setBusy(true);
    const res = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
    const body: ApiResp<unknown> = await res.json();
    setBusy(false);
    if (!body.success) {
      alert(body.error || "삭제 실패");
      return;
    }
    router.push("/dashboard/assignments");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleActive}
          disabled={busy}
          className={active ? "btn-secondary" : "btn-primary"}
          title={active ? "과제 비활성화" : "과제 활성화"}
        >
          {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {active ? "비활성화" : "활성화"}
        </button>
        <button
          onClick={onDelete}
          disabled={busy}
          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col items-end gap-1 text-xs text-gray-600">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={auto}
            onChange={onToggleAuto}
            disabled={busy}
            className="h-3.5 w-3.5 rounded border-gray-300 text-teal focus:ring-teal"
          />
          AI 자동 승인
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showScore}
            onChange={onToggleShowScore}
            disabled={busy}
            className="h-3.5 w-3.5 rounded border-gray-300 text-teal focus:ring-teal"
          />
          학생에게 점수 공개
        </label>
      </div>
    </div>
  );
}
