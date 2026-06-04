"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// 학생이 'AI가 다듬은 글'을 참고해 다시 써 보는 칸.
// 입력 → 저장(PATCH /api/feedback/[id]/rewrite).
// ============================================================
export function RewriteBox({
  feedbackId,
  initial,
}: {
  feedbackId: string;
  initial: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [savedText, setSavedText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = [...text].length;
  const dirty = text !== savedText;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/rewrite`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body: ApiResp<{ studentRewrite: string | null }> = await res.json();
      if (!body.success) {
        setError(body.error || "저장에 실패했어요. 잠시 후 다시 해볼까요?");
        return;
      }
      setSavedText(text);
      router.refresh();
    } catch {
      setError("저장에 실패했어요. 잠시 후 다시 해볼까요?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-area-expression/30 bg-area-expression/5 p-4">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Pencil className="h-4 w-4 text-area-expression" />
        <p className="text-sm font-bold text-area-expression">고쳐 써 보기</p>
      </div>
      <p className="mb-2 text-xs text-gray-600">
        위의 다듬은 글을 참고해서, 내 글을 더 멋지게 다시 써 볼까요?
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input min-h-[160px] text-sm leading-relaxed"
        placeholder="여기에 내 글을 다시 써 보세요."
      />

      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-gray-400">{charCount}자</p>
        <div className="flex items-center gap-2">
          {!dirty && savedText.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
              <Check className="h-3.5 w-3.5" />
              저장됐어요
            </span>
          )}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
