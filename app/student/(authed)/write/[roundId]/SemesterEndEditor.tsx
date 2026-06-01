"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Send } from "lucide-react";

interface RoundInfo {
  id: string;
  roundNumber: number;
  deadline: string;
}
interface Question {
  id: string;
  text: string;
}
interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function SemesterEndEditor({
  round,
  assignment,
  questions,
  initialAnswers,
}: {
  round: RoundInfo;
  assignment: { title: string; description: string | null };
  questions: Question[];
  initialAnswers: Record<string, string>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const q of questions) base[q.id] = initialAnswers[q.id] ?? "";
    return base;
  });
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(JSON.stringify(answers));

  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim()).length;

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function buildPayloadAnswers() {
    return questions.map((q) => ({
      questionId: q.id,
      question: q.text,
      answer: answers[q.id] ?? "",
    }));
  }

  // 자동 임시저장
  useEffect(() => {
    const serialized = JSON.stringify(answers);
    if (serialized === lastSaved.current) return;
    const t = window.setTimeout(() => {
      void doSave({ silent: true });
    }, 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  async function doSave({ silent }: { silent: boolean }) {
    if (busy) return;
    if (!silent) setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentRoundId: round.id,
          answers: buildPayloadAnswers(),
          inputMethod: "TYPED",
          action: "SAVE_DRAFT",
        }),
      });
      const body: ApiResp<{ id: string }> = await res.json();
      if (!body.success) {
        if (!silent) setError(body.error || "저장 실패");
        return;
      }
      lastSaved.current = JSON.stringify(answers);
      setSavedAt(new Date());
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function doSubmit() {
    if (answeredCount === 0) {
      setError("질문에 답을 적어주세요.");
      return;
    }
    if (!confirm("제출하면 더 이상 수정할 수 없어요. 제출할까요?")) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentRoundId: round.id,
          answers: buildPayloadAnswers(),
          inputMethod: "TYPED",
          action: "SUBMIT",
        }),
      });
      const body: ApiResp<{ id: string }> = await res.json();
      if (!body.success) {
        setError(body.error || "제출 실패");
        return;
      }
      router.push("/student/home");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const deadlineLabel = new Date(round.deadline).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-32 md:max-w-4xl">
      <Link href="/student/home" className="text-sm text-gray-500">
        ← 홈
      </Link>

      {/* 과제 정보 */}
      <section className="mt-3">
        <p className="text-xs text-gray-500">
          학기말 글쓰기 · 마감 {deadlineLabel}
        </p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{assignment.title}</h1>
        {assignment.description && (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-bg-subtle p-3 text-sm text-gray-700">
            {assignment.description}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          질문에 솔직하게 답해보세요. 답한 질문 {answeredCount}/{questions.length}
        </p>
      </section>

      {/* 질문별 답변 */}
      <section className="mt-4 space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-semibold text-gray-900">
              <span className="mr-1 text-teal-600">{i + 1}.</span>
              {q.text}
            </p>
            <textarea
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder="여기에 답을 써보세요…"
              className="block w-full min-h-[96px] resize-none rounded-xl border border-gray-200 bg-white p-3 text-base leading-relaxed focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
        ))}
      </section>

      {savedAt && (
        <p className="mt-2 text-right text-xs text-gray-400">
          자동 저장됨 {savedAt.toLocaleTimeString("ko-KR")}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* 액션 바 (고정) */}
      <div className="sticky bottom-20 mt-4 flex gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <button
          onClick={() => void doSave({ silent: false })}
          disabled={busy}
          className="btn-secondary flex-1"
        >
          <Save className="h-4 w-4" />
          임시저장
        </button>
        <button
          onClick={() => void doSubmit()}
          disabled={busy || answeredCount === 0}
          className="btn-primary flex-1"
        >
          <Send className="h-4 w-4" />
          제출하기
        </button>
      </div>
    </main>
  );
}
