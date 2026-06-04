"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Sparkles, RefreshCw, Pencil, Save, X, Wand2 } from "lucide-react";
import { buildAIHeaders, getPreferredProvider } from "@/lib/api-keys";
import type { AIProvider } from "@/lib/ai";

interface Submission {
  id: string;
  text: string;
  charCount: number;
  submittedAt: string | null;
  student: { id: string; name: string; number: number };
  assignment: {
    id: string;
    title: string;
    writingType: string;
    minChars: number | null;
    autoApprove: boolean;
    aiPromptNote: string | null;
  };
  round: { roundNumber: number };
  rubric: {
    name: string;
    totalScore: number;
    areas: { key: string; name: string; maxScore: number }[];
  };
}

interface StudentFeedback {
  praise: string;
  suggestion: string;
  encouragement: string;
}

interface TeacherFeedback {
  areaAnalysis: Record<string, { score: number; comment: string }>;
  topicRelevance?: { rating: string; comment: string } | null;
  grammarErrors: {
    original: string;
    corrected: string;
    type: string;
    explanation: string;
  }[];
  repetitions: { word: string; count: number; alternatives: string[] }[];
  overall: string;
  comparisonWithPrevious: string | null;
  teachingDirection: string;
}

// 주제 관련성 등급 → 뱃지 색상
const RELEVANCE_BADGE: Record<string, string> = {
  높음: "bg-teal-50 text-teal-700",
  보통: "bg-amber-50 text-amber-700",
  낮음: "bg-rose-50 text-rose-700",
};

interface Feedback {
  id: string;
  scores: Record<string, number>;
  totalScore: number;
  feedbackStudent: StudentFeedback;
  teacherEditedStudent: StudentFeedback | null;
  feedbackTeacher: TeacherFeedback;
  teacherComment: string | null;
  correctedText: string | null;
  approvalStatus: string;
  approvedAt: string | null;
  aiProvider: string;
}

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const AREA_COLOR: Record<string, string> = {
  content: "text-area-content",
  structure: "text-area-structure",
  expression: "text-area-expression",
  grammar: "text-area-grammar",
  volume: "text-area-volume",
};

export function FeedbackReview({
  submission,
  feedback,
}: {
  submission: Submission;
  feedback: Feedback | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 학생용 피드백 편집 상태
  const initialStudentFb = feedback?.teacherEditedStudent ?? feedback?.feedbackStudent;
  const [editingStudent, setEditingStudent] = useState(false);
  const [editedStudent, setEditedStudent] = useState<StudentFeedback>(
    initialStudentFb ?? { praise: "", suggestion: "", encouragement: "" }
  );

  // 교사 코멘트
  const [teacherComment, setTeacherComment] = useState(feedback?.teacherComment ?? "");

  // AI 다듬기(수정해 주기) 결과 — 교사가 편집 가능
  const [correctedText, setCorrectedText] = useState(feedback?.correctedText ?? "");
  const [correcting, setCorrecting] = useState(false);

  // AI 분석 트리거
  async function runAnalysis() {
    setBusy(true);
    setError(null);
    try {
      const provider: AIProvider = getPreferredProvider();
      const res = await fetch("/api/analyze/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAIHeaders(provider),
        },
        body: JSON.stringify({ submissionId: submission.id, provider }),
      });
      const body: ApiResp<unknown> = await res.json();
      if (!body.success) {
        setError(body.error || "AI 분석 실패");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // "수정해 주기(AI)" — 피드백에 근거해 학생 글을 다듬어 받기
  async function runCorrection() {
    if (!feedback) return;
    setCorrecting(true);
    setError(null);
    try {
      const provider: AIProvider = getPreferredProvider();
      const res = await fetch("/api/analyze/correct", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAIHeaders(provider),
        },
        body: JSON.stringify({ feedbackId: feedback.id, provider }),
      });
      const body: ApiResp<{ correctedText: string }> = await res.json();
      if (!body.success || !body.data) {
        setError(body.error || "AI 다듬기 실패");
        return;
      }
      setCorrectedText(body.data.correctedText);
    } finally {
      setCorrecting(false);
    }
  }

  async function saveEdit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedback!.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teacherEditedStudent: editedStudent,
          teacherComment: teacherComment.trim() || null,
          correctedText: correctedText.trim() || null,
        }),
      });
      const body: ApiResp<unknown> = await res.json();
      if (!body.success) {
        setError(body.error || "저장 실패");
        return;
      }
      setEditingStudent(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!confirm("승인하면 학생에게 즉시 공개됩니다. 진행할까요?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedback!.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teacherEditedStudent: editedStudent,
          teacherComment: teacherComment.trim() || null,
          correctedText: correctedText.trim() || null,
          approve: true,
        }),
      });
      const body: ApiResp<unknown> = await res.json();
      if (!body.success) {
        setError(body.error || "승인 실패");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/dashboard/feedback" className="text-sm text-gray-500">
        ← 피드백 목록
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">
            {submission.assignment.writingType} · {submission.round.roundNumber}회차 ·{" "}
            {submission.charCount}자
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            {submission.assignment.title}
          </h1>
          <p className="mt-1 text-sm text-gray-700">
            <span className="font-medium">
              {submission.student.number}번 {submission.student.name}
            </span>
            <span className="ml-2 text-xs text-gray-500">
              {submission.submittedAt &&
                `제출 ${new Date(submission.submittedAt).toLocaleString("ko-KR")}`}
            </span>
          </p>
        </div>
        {feedback?.approvalStatus === "APPROVED" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
            <CheckCircle2 className="h-4 w-4" />
            승인됨
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* 좌: 원문 + AI 다듬기 */}
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            학생이 쓴 글
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {submission.text}
          </p>

          {/* 수정해 주기(AI): 피드백이 있어야 다듬기 가능 */}
          {feedback && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  AI가 다듬은 글
                </h3>
                <button
                  onClick={runCorrection}
                  disabled={correcting || busy}
                  className="inline-flex items-center gap-1 rounded-lg border border-area-expression/30 bg-area-expression/5 px-3 py-1.5 text-xs font-medium text-area-expression hover:bg-area-expression/10 disabled:opacity-50"
                  title="피드백에 근거해 AI가 글을 다듬어 줍니다"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {correcting
                    ? "다듬는 중..."
                    : correctedText
                      ? "다시 수정해 주기(AI)"
                      : "수정해 주기(AI)"}
                </button>
              </div>

              {correctedText ? (
                <>
                  <textarea
                    value={correctedText}
                    onChange={(e) => setCorrectedText(e.target.value)}
                    className="input min-h-[160px] text-sm leading-relaxed"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    맞춤법·문법 오류와 제안을 반영한 글이에요. 자유롭게 고친 뒤
                    <span className="font-medium text-gray-700"> 저장</span>하면, 승인 후
                    학생 피드백의 &lsquo;고쳐 쓴 글&rsquo;로 보여집니다.
                  </p>
                </>
              ) : (
                <p className="rounded-lg bg-bg-subtle px-3 py-2 text-xs text-gray-600">
                  버튼을 누르면 AI가 맞춤법·문법 오류와 제안을 반영해 글을 다듬어
                  줍니다. 원본은 그대로 두고, 다듬은 글만 따로 저장돼요.
                </p>
              )}
            </div>
          )}
        </section>

        {/* 우: 분석 결과 */}
        <section className="space-y-4">
          {!feedback ? (
            <div className="card text-center">
              <Sparkles className="mx-auto mb-2 h-8 w-8 text-area-expression" />
              <p className="text-sm text-gray-700">아직 AI 분석을 실행하지 않았습니다.</p>
              <button
                onClick={runAnalysis}
                disabled={busy}
                className="btn-primary mt-4"
              >
                {busy ? "분석 중..." : "AI로 분석 시작"}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                현재 제공자: {getPreferredProvider() === "claude" ? "Claude" : "Gemini"}{" "}
                · 설정에서 변경 가능
              </p>
            </div>
          ) : (
            <>
              {/* 점수 카드 */}
              <div className="card">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    영역별 점수
                  </h2>
                  <p className="text-xl font-bold text-gray-900">
                    {feedback.totalScore}
                    <span className="text-sm font-normal text-gray-500">
                      {" "}
                      / {submission.rubric.totalScore}
                    </span>
                  </p>
                </div>
                <ul className="space-y-2">
                  {submission.rubric.areas.map((area) => {
                    const score = feedback.scores[area.key] ?? 0;
                    const pct = (score / area.maxScore) * 100;
                    return (
                      <li key={area.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className={`font-medium ${AREA_COLOR[area.key] ?? "text-gray-800"}`}>
                            {area.name}
                          </span>
                          <span className="text-gray-700">
                            {score} / {area.maxScore}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-current opacity-70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={runAnalysis}
                  disabled={busy}
                  className="btn-secondary mt-4 w-full text-xs"
                  title="AI 다시 호출"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  다시 분석하기
                </button>
              </div>

              {/* 교사용 분석 */}
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  교사용 분석
                </h2>
                <p className="text-sm text-gray-800">{feedback.feedbackTeacher.overall}</p>

                {feedback.feedbackTeacher.topicRelevance && (
                  <div className="rounded-lg border border-gray-100 bg-bg-subtle p-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">
                        주제 관련성
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          RELEVANCE_BADGE[feedback.feedbackTeacher.topicRelevance.rating] ??
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {feedback.feedbackTeacher.topicRelevance.rating}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">
                      {feedback.feedbackTeacher.topicRelevance.comment}
                    </p>
                  </div>
                )}

                {feedback.feedbackTeacher.comparisonWithPrevious && (
                  <p className="rounded-lg bg-bg-subtle p-2 text-xs text-gray-700">
                    이전 회차 대비: {feedback.feedbackTeacher.comparisonWithPrevious}
                  </p>
                )}

                {feedback.feedbackTeacher.grammarErrors.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-gray-700">
                      맞춤법·문법 오류 ({feedback.feedbackTeacher.grammarErrors.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {feedback.feedbackTeacher.grammarErrors.map((g, i) => (
                        <li key={i} className="rounded bg-gray-50 px-2 py-1">
                          <span className="line-through text-area-grammar">{g.original}</span>
                          {" → "}
                          <span className="font-medium text-gray-900">{g.corrected}</span>
                          <span className="ml-2 text-gray-500">({g.type})</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {feedback.feedbackTeacher.repetitions.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-gray-700">
                      반복 표현 ({feedback.feedbackTeacher.repetitions.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {feedback.feedbackTeacher.repetitions.map((r, i) => (
                        <li key={i}>
                          <span className="font-medium">{r.word}</span>
                          <span className="text-gray-500"> {r.count}회</span>
                          {r.alternatives.length > 0 && (
                            <span className="ml-1 text-gray-600">
                              → {r.alternatives.join(", ")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="rounded-lg bg-bg-subtle p-3 text-xs">
                  <p className="mb-1 font-semibold text-gray-700">다음 지도 방향</p>
                  <p className="text-gray-700">
                    {feedback.feedbackTeacher.teachingDirection}
                  </p>
                </div>
              </div>

              {/* 학생용 피드백 (편집 가능) */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    학생에게 전달할 피드백
                  </h2>
                  {!editingStudent ? (
                    <button
                      onClick={() => setEditingStudent(true)}
                      className="text-xs font-medium text-teal hover:underline"
                    >
                      <Pencil className="mr-1 inline h-3 w-3" />
                      수정
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingStudent(false);
                          setEditedStudent(
                            initialStudentFb ?? {
                              praise: "",
                              suggestion: "",
                              encouragement: "",
                            }
                          );
                        }}
                        className="text-xs text-gray-500"
                      >
                        <X className="mr-0.5 inline h-3 w-3" />
                        취소
                      </button>
                    </div>
                  )}
                </div>

                {feedback.teacherEditedStudent && !editingStudent && (
                  <p className="rounded bg-teal-50 px-2 py-1 text-xs text-teal-700">
                    선생님이 수정한 버전이 학생에게 전달됩니다.
                  </p>
                )}

                <StudentField
                  label="잘한 점"
                  value={editingStudent ? editedStudent.praise : initialStudentFb!.praise}
                  editing={editingStudent}
                  onChange={(v) => setEditedStudent((s) => ({ ...s, praise: v }))}
                />
                <StudentField
                  label="제안"
                  value={editingStudent ? editedStudent.suggestion : initialStudentFb!.suggestion}
                  editing={editingStudent}
                  onChange={(v) => setEditedStudent((s) => ({ ...s, suggestion: v }))}
                />
                <StudentField
                  label="응원"
                  value={
                    editingStudent ? editedStudent.encouragement : initialStudentFb!.encouragement
                  }
                  editing={editingStudent}
                  onChange={(v) => setEditedStudent((s) => ({ ...s, encouragement: v }))}
                />
              </div>

              {/* 교사 코멘트 */}
              <div className="card">
                <label className="label">선생님의 직접 코멘트 (선택)</label>
                <textarea
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="AI 피드백 외에 학생에게 직접 남기고 싶은 말"
                />
              </div>

              {/* 액션 */}
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={busy}
                  className="btn-secondary flex-1"
                >
                  <Save className="h-4 w-4" />
                  저장만
                </button>
                <button
                  onClick={approve}
                  disabled={busy || feedback.approvalStatus === "APPROVED"}
                  className="btn-primary flex-1"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {feedback.approvalStatus === "APPROVED" ? "이미 승인됨" : "저장하고 승인"}
                </button>
              </div>

              <p className="text-center text-xs text-gray-400">
                AI 제공자: {feedback.aiProvider}
                {feedback.approvedAt &&
                  ` · 승인 ${new Date(feedback.approvedAt).toLocaleString("ko-KR")}`}
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function StudentField({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input min-h-[70px] text-sm"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-gray-800">{value}</p>
      )}
    </div>
  );
}
