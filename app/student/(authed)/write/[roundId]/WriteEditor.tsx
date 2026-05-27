"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Save, Send, Sparkles, Type } from "lucide-react";
import { buildAIHeaders, getPreferredProvider } from "@/lib/api-keys";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  writingType: string;
  minChars: number | null;
  recommendedChars: number | null;
}
interface RoundInfo {
  id: string;
  roundNumber: number;
  deadline: string;
}
interface Initial {
  id: string;
  text: string;
  charCount: number;
  status: string;
}
interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface OcrSegment {
  text: string;
  confidence: number;
}
interface LowConfidenceWord {
  original: string;
  candidates: string[];
  confidence: number;
  reason: string;
}
interface OcrResult {
  imageUrl: string;
  aiProvider: "gemini" | "claude";
  fullText: string;
  segments: OcrSegment[];
  overallConfidence: number;
  lowConfidenceWords: LowConfidenceWord[];
}

type Mode = "TYPED" | "STUDENT_OCR";

export function WriteEditor({
  round,
  assignment,
  initial,
}: {
  round: RoundInfo;
  assignment: Assignment;
  initial: Initial | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("TYPED");
  const [text, setText] = useState(initial?.text ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialText = useRef(initial?.text ?? "");

  // OCR 상태
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = [...text].length;
  const meetsMin = !assignment.minChars || charCount >= assignment.minChars;

  // 자동 임시저장
  useEffect(() => {
    if (text === initialText.current) return;
    const t = window.setTimeout(() => {
      void doSave({ silent: true });
    }, 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function buildOcrPayload() {
    if (mode !== "STUDENT_OCR" || !ocr) return null;
    // 학생이 편집한 결과 → corrections에 (원문 ↔ 최종) 기록은 생략하고, edited만 보관
    return {
      imageUrl: ocr.imageUrl,
      ocrRawText: ocr.fullText,
      confidence: ocr.overallConfidence,
      aiProvider: ocr.aiProvider,
      segments: ocr.segments,
      corrections: [],
    };
  }

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
          text,
          inputMethod: mode,
          action: "SAVE_DRAFT",
          ocr: buildOcrPayload(),
        }),
      });
      const body: ApiResp<{ id: string }> = await res.json();
      if (!body.success) {
        if (!silent) setError(body.error || "저장 실패");
        return;
      }
      initialText.current = text;
      setSavedAt(new Date());
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function doSubmit() {
    if (!meetsMin) {
      setError(
        `최소 ${assignment.minChars}자 이상 써야 제출할 수 있어요. (지금 ${charCount}자)`
      );
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
          text,
          inputMethod: mode,
          action: "SUBMIT",
          ocr: buildOcrPayload(),
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

  async function runOcr(file: File) {
    setError(null);
    setOcrBusy(true);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("assignmentRoundId", round.id);
      const provider = getPreferredProvider();
      form.append("provider", provider);

      const headers = buildAIHeaders(provider);
      // FormData 사용 시 content-type은 자동, x-ai-provider/키만 헤더로 부착
      const res = await fetch("/api/analyze/ocr", {
        method: "POST",
        body: form,
        headers,
      });
      const body: ApiResp<OcrResult> = await res.json();
      if (!body.success || !body.data) {
        setError(body.error || "사진 인식에 실패했어요.");
        return;
      }
      setOcr(body.data);
      // 인식된 텍스트로 에디터 초기화 (사용자가 이후 편집)
      setText(body.data.fullText);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "네트워크 오류";
      setError(`사진 인식 실패: ${msg}`);
    } finally {
      setOcrBusy(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    void runOcr(f);
    e.target.value = "";
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
          {assignment.writingType} · {round.roundNumber}회차 · 마감 {deadlineLabel}
        </p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{assignment.title}</h1>
        {assignment.description && (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-bg-subtle p-3 text-sm text-gray-700">
            {assignment.description}
          </p>
        )}
      </section>

      {/* 모드 전환 */}
      <section className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("TYPED")}
          className={
            "flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium " +
            (mode === "TYPED"
              ? "border-teal bg-teal/10 text-teal"
              : "border-gray-200 bg-white text-gray-600")
          }
        >
          <Type className="h-4 w-4" /> 직접 입력
        </button>
        <button
          type="button"
          onClick={() => setMode("STUDENT_OCR")}
          className={
            "flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium " +
            (mode === "STUDENT_OCR"
              ? "border-teal bg-teal/10 text-teal"
              : "border-gray-200 bg-white text-gray-600")
          }
        >
          <Camera className="h-4 w-4" /> 사진 촬영
        </button>
      </section>

      {/* OCR 영역 */}
      {mode === "STUDENT_OCR" && (
        <section className="mt-3 rounded-2xl border border-dashed border-teal/40 bg-teal/5 p-3 text-sm">
          <p className="text-gray-700">
            손글씨 사진을 올리면 AI가 글자로 바꿔줘요. 인식한 글은 아래에서 직접 고칠 수 있어요.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={onPickFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrBusy}
            className="btn-primary mt-2 w-full"
          >
            <Sparkles className="h-4 w-4" />
            {ocrBusy ? "인식 중…" : ocr ? "다른 사진으로 다시 인식" : "사진 촬영/선택"}
          </button>

          {ocr && (
            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <p>
                인식 신뢰도{" "}
                <span className="font-semibold text-gray-800">
                  {Math.round(ocr.overallConfidence * 100)}%
                </span>{" "}
                · {ocr.aiProvider}
              </p>
              {ocr.lowConfidenceWords.length > 0 && (
                <details className="rounded-md bg-white p-2">
                  <summary className="cursor-pointer text-area-grammar">
                    확신이 낮은 글자 {ocr.lowConfidenceWords.length}개 확인
                  </summary>
                  <ul className="mt-1 list-disc pl-4">
                    {ocr.lowConfidenceWords.map((w, i) => (
                      <li key={i}>
                        <span className="font-medium">{w.original}</span>
                        {w.candidates.length > 0 && (
                          <span className="ml-1 text-gray-500">
                            → {w.candidates.join(", ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>
      )}

      {/* 에디터 */}
      <section className="mt-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            mode === "STUDENT_OCR"
              ? "사진을 인식하면 여기에 글이 나타나요. 잘못 인식된 부분은 직접 고칠 수 있어요."
              : "여기에 글을 써보세요…"
          }
          className="block w-full min-h-[50vh] resize-none rounded-2xl border border-gray-200 bg-white p-4 text-base leading-relaxed shadow-sm focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={meetsMin ? "text-gray-500" : "text-area-grammar"}>
            {charCount}자
            {assignment.minChars && ` / 최소 ${assignment.minChars}자`}
            {assignment.recommendedChars &&
              ` · 권장 ${assignment.recommendedChars}자`}
          </span>
          {savedAt && (
            <span className="text-gray-400">
              자동 저장됨 {savedAt.toLocaleTimeString("ko-KR")}
            </span>
          )}
        </div>
      </section>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* 액션 바 (고정) */}
      <div className="sticky bottom-20 mt-4 flex gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <button
          onClick={() => void doSave({ silent: false })}
          disabled={busy || text === initialText.current}
          className="btn-secondary flex-1"
        >
          <Save className="h-4 w-4" />
          임시저장
        </button>
        <button
          onClick={() => void doSubmit()}
          disabled={busy || charCount === 0}
          className="btn-primary flex-1"
        >
          <Send className="h-4 w-4" />
          제출하기
        </button>
      </div>
    </main>
  );
}
