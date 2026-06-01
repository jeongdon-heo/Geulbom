"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, X } from "lucide-react";
import { DEFAULT_BEHAVIOR_QUESTIONS } from "@/lib/prompts";

interface ClassOpt {
  id: string;
  name: string;
  year: number;
}
interface RubricOpt {
  id: string;
  name: string;
  totalScore: number;
  teacher: { role: string; name: string };
}
interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type AssignType = "REGULAR" | "IRREGULAR" | "SEMESTER_END";
type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

interface QuestionItem {
  id: string;
  text: string;
}

const WRITING_TYPES = ["일기", "독후감", "관찰글", "주장하는 글", "설명하는 글", "감상문"];
const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

const TYPE_OPTIONS: { value: AssignType; label: string; desc: string }[] = [
  { value: "REGULAR", label: "정기", desc: "주간 일기 등 회차 자동 생성" },
  { value: "IRREGULAR", label: "비정기", desc: "독후감 등 단일 마감" },
  { value: "SEMESTER_END", label: "학기말 글쓰기", desc: "행동특성 자료 수집" },
];

export function AssignmentForm({
  classes,
  rubrics,
}: {
  classes: ClassOpt[];
  rubrics: RubricOpt[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 공통
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [rubricTemplateId, setRubricTemplateId] = useState(rubrics[0]?.id ?? "");
  const [type, setType] = useState<AssignType>("REGULAR");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [writingType, setWritingType] = useState("일기");
  const [writingTypeOther, setWritingTypeOther] = useState("");
  const [minChars, setMinChars] = useState<string>("200");
  const [recommendedChars, setRecommendedChars] = useState<string>("400");
  const [aiPromptNote, setAiPromptNote] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [showScoreToStudent, setShowScoreToStudent] = useState(true);

  // 정기 전용
  const [frequency, setFrequency] = useState<Frequency>("WEEKLY");
  const [dayOfWeek, setDayOfWeek] = useState<number>(5); // 금
  const today = new Date();
  const [startDate, setStartDate] = useState<string>(toDateInput(today));
  const [endDate, setEndDate] = useState<string>(
    toDateInput(new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()))
  );

  // 비정기 / 학기말 전용
  const [deadline, setDeadline] = useState<string>(
    toDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7))
  );

  // 학기말 글쓰기 질문
  const [questions, setQuestions] = useState<QuestionItem[]>(
    DEFAULT_BEHAVIOR_QUESTIONS.map((q) => ({ ...q }))
  );
  const nextQid = useRef(DEFAULT_BEHAVIOR_QUESTIONS.length + 1);

  const isSemesterEnd = type === "SEMESTER_END";

  function updateQuestion(id: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, text } : q)));
  }
  function addQuestion() {
    setQuestions((prev) => [...prev, { id: `q${nextQid.current++}`, text: "" }]);
  }
  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }
  function moveQuestion(index: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        classId,
        title: title.trim(),
        description: description.trim() || null,
        type,
        aiPromptNote: aiPromptNote.trim() || null,
      };

      if (isSemesterEnd) {
        // 학기말 글쓰기: 루브릭/채점 없음, 질문 + 단일 마감
        const qs = questions
          .map((q) => ({ id: q.id, text: q.text.trim() }))
          .filter((q) => q.text.length > 0)
          .map((q, i) => ({ id: q.id || `q${i + 1}`, text: q.text }));
        if (qs.length === 0) {
          setError("질문을 최소 1개 입력해주세요.");
          setSubmitting(false);
          return;
        }
        payload.rubricTemplateId = null;
        payload.writingType = "학기말 글쓰기";
        payload.minChars = null;
        payload.recommendedChars = null;
        payload.autoApprove = false;
        payload.showScoreToStudent = true;
        payload.questions = qs;
        payload.deadline = new Date(deadline + "T23:59:59").toISOString();
      } else {
        const finalWritingType =
          writingType === "기타" ? writingTypeOther.trim() : writingType;
        if (!finalWritingType) {
          setError("글 종류를 입력해주세요.");
          setSubmitting(false);
          return;
        }
        payload.rubricTemplateId = rubricTemplateId;
        payload.writingType = finalWritingType;
        payload.minChars = minChars ? Number(minChars) : null;
        payload.recommendedChars = recommendedChars ? Number(recommendedChars) : null;
        payload.autoApprove = autoApprove;
        payload.showScoreToStudent = showScoreToStudent;

        if (type === "REGULAR") {
          payload.frequency = frequency;
          payload.dayOfWeek =
            frequency === "WEEKLY" || frequency === "BIWEEKLY" ? dayOfWeek : null;
          payload.startDate = new Date(startDate + "T00:00:00").toISOString();
          payload.endDate = new Date(endDate + "T23:59:59").toISOString();
        } else {
          payload.deadline = new Date(deadline + "T23:59:59").toISOString();
        }
      }

      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: ApiResp<{ id: string; roundCount: number }> = await res.json();
      if (!body.success || !body.data) {
        setError(body.error || "과제 생성에 실패했습니다.");
        return;
      }
      router.push(`/dashboard/assignments/${body.data.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  // 회차 미리보기 (정기일 때)
  const previewCount = (() => {
    if (type !== "REGULAR" || !startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (s > e) return 0;
    if (frequency === "DAILY") {
      return Math.floor((+e - +s) / 86400000) + 1;
    }
    if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
      const step = frequency === "WEEKLY" ? 7 : 14;
      let count = 0;
      const first = new Date(s);
      first.setDate(first.getDate() + ((dayOfWeek - first.getDay() + 7) % 7));
      for (let d = new Date(first); d <= e; d.setDate(d.getDate() + step)) count++;
      return count;
    }
    if (frequency === "MONTHLY") {
      const months =
        (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
      return Math.max(0, months);
    }
    return 0;
  })();

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 과제 유형 */}
      <Section title="과제 유형">
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPE_OPTIONS.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                type === t.value
                  ? "border-teal bg-teal-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  type === t.value ? "text-teal-700" : "text-gray-800"
                }`}
              >
                {t.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{t.desc}</p>
            </button>
          ))}
        </div>
        {isSemesterEnd && (
          <p className="rounded-lg bg-bg-subtle px-3 py-2 text-xs text-gray-600">
            학기말 글쓰기는 채점·피드백 없이 학생의 답변만 모읍니다. 모인 답변으로{" "}
            <span className="font-medium text-gray-800">행동특성 및 종합의견</span> 초안을
            생성할 수 있어요. (행동특성 메뉴)
          </p>
        )}
      </Section>

      {/* 기본 정보 */}
      <Section title="기본 정보">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="학급">
            <select
              required
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="input"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.year}년)
                </option>
              ))}
            </select>
          </Field>
          {!isSemesterEnd && (
            <Field label="루브릭">
              <select
                required
                value={rubricTemplateId}
                onChange={(e) => setRubricTemplateId(e.target.value)}
                className="input"
              >
                {rubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.totalScore}점)
                    {r.teacher.role === "admin" ? " · 기본" : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="과제 제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder={isSemesterEnd ? "1학기 나의 성장 돌아보기" : "주간 일기"}
          />
        </Field>
        <Field label={isSemesterEnd ? "안내문 (선택)" : "안내 / 주제 설명 (선택)"}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[80px]"
            placeholder={
              isSemesterEnd
                ? "한 학기 동안의 나를 돌아보며 솔직하게 답해보세요."
                : "이번 주에 가장 기억에 남는 일을 자세히 써보세요."
            }
          />
        </Field>
      </Section>

      {/* 학기말 글쓰기: 질문 */}
      {isSemesterEnd && (
        <Section title="질문">
          <p className="text-xs text-gray-500">
            학생이 항목별로 답하게 됩니다. 행동특성 작성에 도움이 되도록 기본 질문을
            제공하니 자유롭게 수정·추가·삭제하세요.
          </p>
          <ul className="space-y-2">
            {questions.map((q, i) => (
              <li key={q.id} className="flex items-start gap-2">
                <div className="flex flex-col items-center pt-2">
                  <span className="text-xs font-semibold text-gray-400">{i + 1}</span>
                </div>
                <textarea
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, e.target.value)}
                  className="input min-h-[44px] flex-1"
                  placeholder="질문을 입력하세요"
                  rows={2}
                />
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(i, -1)}
                    disabled={i === 0}
                    title="위로"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    title="삭제"
                    className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addQuestion}
            disabled={questions.length >= 15}
            className="btn-secondary"
          >
            <Plus className="h-4 w-4" />
            질문 추가
          </button>
        </Section>
      )}

      {/* 글 형식 (정기/비정기만) */}
      {!isSemesterEnd && (
        <Section title="글 형식">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="글 종류">
              <select
                value={writingType}
                onChange={(e) => setWritingType(e.target.value)}
                className="input"
              >
                {WRITING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="기타">기타...</option>
              </select>
              {writingType === "기타" && (
                <input
                  value={writingTypeOther}
                  onChange={(e) => setWritingTypeOther(e.target.value)}
                  className="input mt-2"
                  placeholder="직접 입력"
                />
              )}
            </Field>
            <Field label="최소 글자 수 (선택)">
              <input
                type="number"
                min={0}
                value={minChars}
                onChange={(e) => setMinChars(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="권장 글자 수 (선택)">
              <input
                type="number"
                min={0}
                value={recommendedChars}
                onChange={(e) => setRecommendedChars(e.target.value)}
                className="input"
              />
            </Field>
          </div>
        </Section>
      )}

      {/* 일정 */}
      <Section title="일정">
        {type === "REGULAR" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="빈도">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  className="input"
                >
                  <option value="DAILY">매일</option>
                  <option value="WEEKLY">매주</option>
                  <option value="BIWEEKLY">격주</option>
                  <option value="MONTHLY">매월</option>
                </select>
              </Field>
              {(frequency === "WEEKLY" || frequency === "BIWEEKLY") && (
                <Field label="요일">
                  <div className="flex gap-1">
                    {DOW_LABEL.map((d, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setDayOfWeek(i)}
                        className={`h-9 w-9 rounded-lg border text-sm font-medium ${
                          dayOfWeek === i
                            ? "border-teal bg-teal-50 text-teal-700"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="시작일">
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="종료일">
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <p className="rounded-lg bg-bg-subtle px-3 py-2 text-xs text-gray-600">
              예상 회차 수:{" "}
              <span className="font-semibold text-gray-900">{previewCount}회</span>
            </p>
          </div>
        ) : (
          <Field label="마감일">
            <input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input"
            />
          </Field>
        )}
      </Section>

      {/* AI / 공개 옵션 */}
      <Section title={isSemesterEnd ? "AI" : "AI · 학생 공개"}>
        <Field
          label={
            isSemesterEnd
              ? "행동특성 초안 생성 시 AI에게 줄 지시 (선택)"
              : "AI에게 줄 추가 지시 (선택)"
          }
        >
          <textarea
            value={aiPromptNote}
            onChange={(e) => setAiPromptNote(e.target.value)}
            className="input min-h-[80px]"
            placeholder={
              isSemesterEnd
                ? "예: 긍정적인 면을 중심으로, 구체적인 행동 사례를 들어주세요."
                : "예: 표현 영역을 더 엄격하게 채점해주세요."
            }
          />
        </Field>
        {!isSemesterEnd && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-teal focus:ring-teal"
              />
              AI 결과를 자동으로 학생에게 공개 (교사 검토 생략)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showScoreToStudent}
                onChange={(e) => setShowScoreToStudent(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-teal focus:ring-teal"
              />
              학생에게 점수도 함께 보여주기
            </label>
          </div>
        )}
      </Section>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          취소
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "생성 중..." : "과제 만들기"}
        </button>
      </div>
    </form>
  );
}

// ── 작은 UI 헬퍼 ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      {children}
    </div>
  );
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
