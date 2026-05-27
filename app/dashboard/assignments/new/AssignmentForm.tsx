"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

type AssignType = "REGULAR" | "IRREGULAR";
type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

const WRITING_TYPES = ["일기", "독후감", "관찰글", "주장하는 글", "설명하는 글", "감상문"];
const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

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

  // 비정기 전용
  const [deadline, setDeadline] = useState<string>(
    toDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7))
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const finalWritingType = writingType === "기타" ? writingTypeOther.trim() : writingType;
    if (!finalWritingType) {
      setError("글 종류를 입력해주세요.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      classId,
      rubricTemplateId,
      title: title.trim(),
      description: description.trim() || null,
      type,
      writingType: finalWritingType,
      minChars: minChars ? Number(minChars) : null,
      recommendedChars: recommendedChars ? Number(recommendedChars) : null,
      aiPromptNote: aiPromptNote.trim() || null,
      autoApprove,
      showScoreToStudent,
    };

    if (type === "REGULAR") {
      payload.frequency = frequency;
      payload.dayOfWeek =
        frequency === "WEEKLY" || frequency === "BIWEEKLY" ? dayOfWeek : null;
      payload.startDate = new Date(startDate + "T00:00:00").toISOString();
      payload.endDate = new Date(endDate + "T23:59:59").toISOString();
    } else {
      payload.deadline = new Date(deadline + "T23:59:59").toISOString();
    }

    try {
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
        </div>
        <Field label="과제 제목">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="주간 일기"
          />
        </Field>
        <Field label="안내 / 주제 설명 (선택)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[80px]"
            placeholder="이번 주에 가장 기억에 남는 일을 자세히 써보세요."
          />
        </Field>
      </Section>

      {/* 글 형식 */}
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

      {/* 일정 */}
      <Section title="일정">
        <div className="mb-3 flex gap-2">
          {(["REGULAR", "IRREGULAR"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg border px-4 py-1.5 text-sm font-medium ${
                type === t
                  ? "border-teal bg-teal-50 text-teal-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t === "REGULAR" ? "정기 (회차 자동 생성)" : "비정기 (단일 마감)"}
            </button>
          ))}
        </div>

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
      <Section title="AI · 학생 공개">
        <Field label="AI에게 줄 추가 지시 (선택)">
          <textarea
            value={aiPromptNote}
            onChange={(e) => setAiPromptNote(e.target.value)}
            className="input min-h-[80px]"
            placeholder="예: 표현 영역을 더 엄격하게 채점해주세요."
          />
        </Field>
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
