"use client";

import { useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Layers,
  Loader2,
  Save,
  Send,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { buildAIHeaders, getPreferredProvider } from "@/lib/api-keys";
import type {
  OcrAssignment,
  OcrClass,
  OcrPageData,
  OcrRound,
  OcrStudent,
} from "./types";

type Mode = "single" | "bulk";

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
interface OcrApiResult {
  imageUrl: string;
  aiProvider: "gemini" | "claude";
  fullText: string;
  segments: OcrSegment[];
  overallConfidence: number;
  lowConfidenceWords: LowConfidenceWord[];
}

interface BulkItem {
  localId: string;
  file: File;
  previewUrl: string;
  studentId: string | null;
  ocr: OcrApiResult | null;
  editedText: string;
  status: "idle" | "ocring" | "ready" | "saving" | "saved" | "error";
  errorMsg?: string;
}

export function OcrWorkspace({ data }: { data: OcrPageData }) {
  const [mode, setMode] = useState<Mode>("single");

  const [classId, setClassId] = useState<string>(data.classes[0]?.id ?? "");
  const currentClass = useMemo<OcrClass | null>(
    () => data.classes.find((c) => c.id === classId) ?? null,
    [data, classId]
  );

  const [assignmentId, setAssignmentId] = useState<string>(
    currentClass?.assignments[0]?.id ?? ""
  );
  const currentAssignment = useMemo<OcrAssignment | null>(
    () => currentClass?.assignments.find((a) => a.id === assignmentId) ?? null,
    [currentClass, assignmentId]
  );

  const [roundId, setRoundId] = useState<string>(
    currentAssignment?.rounds[0]?.id ?? ""
  );
  const currentRound = useMemo<OcrRound | null>(
    () => currentAssignment?.rounds.find((r) => r.id === roundId) ?? null,
    [currentAssignment, roundId]
  );

  // class 변경 시 하위 선택 초기화
  function onClassChange(id: string) {
    setClassId(id);
    const c = data.classes.find((x) => x.id === id);
    const firstA = c?.assignments[0];
    setAssignmentId(firstA?.id ?? "");
    setRoundId(firstA?.rounds[0]?.id ?? "");
  }
  function onAssignmentChange(id: string) {
    setAssignmentId(id);
    const a = currentClass?.assignments.find((x) => x.id === id);
    setRoundId(a?.rounds[0]?.id ?? "");
  }

  return (
    <div className="space-y-6">
      {/* 모드 전환 */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        <ModeTab
          active={mode === "single"}
          onClick={() => setMode("single")}
          icon={<User className="h-4 w-4" />}
          label="개별 모드"
        />
        <ModeTab
          active={mode === "bulk"}
          onClick={() => setMode("bulk")}
          icon={<Layers className="h-4 w-4" />}
          label="일괄 모드"
        />
      </div>

      {/* 공통 필터 */}
      <div className="card grid gap-3 md:grid-cols-3">
        <FilterSelect
          label="학급"
          value={classId}
          onChange={onClassChange}
          options={data.classes.map((c) => ({
            value: c.id,
            label: `${c.year} ${c.name}`,
          }))}
        />
        <FilterSelect
          label="과제"
          value={assignmentId}
          onChange={onAssignmentChange}
          options={
            currentClass?.assignments.map((a) => ({
              value: a.id,
              label: a.title,
            })) ?? []
          }
          disabled={!currentClass || currentClass.assignments.length === 0}
          empty={!currentClass?.assignments.length ? "진행 중인 과제가 없어요" : undefined}
        />
        <FilterSelect
          label="회차"
          value={roundId}
          onChange={setRoundId}
          options={
            currentAssignment?.rounds.map((r) => ({
              value: r.id,
              label: `${r.roundNumber}회차${r.title ? ` · ${r.title}` : ""}`,
            })) ?? []
          }
          disabled={!currentAssignment || currentAssignment.rounds.length === 0}
          empty={!currentAssignment?.rounds.length ? "열린 회차가 없어요" : undefined}
        />
      </div>

      {mode === "single" ? (
        <SingleMode
          students={currentClass?.students ?? []}
          round={currentRound}
          assignment={currentAssignment}
        />
      ) : (
        <BulkMode
          students={currentClass?.students ?? []}
          round={currentRound}
          assignment={currentAssignment}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────
// 개별 모드
// ────────────────────────────────────────

function SingleMode({
  students,
  round,
  assignment,
}: {
  students: OcrStudent[];
  round: OcrRound | null;
  assignment: OcrAssignment | null;
}) {
  const [studentId, setStudentId] = useState<string>(students[0]?.id ?? "");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [ocr, setOcr] = useState<OcrApiResult | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 학생 변경 시 결과 초기화
  function onStudentChange(id: string) {
    setStudentId(id);
    setOcr(null);
    setText("");
    setError(null);
    setSuccess(null);
  }

  async function runOcr(file: File) {
    if (!round || !studentId) {
      setError("학급/과제/회차/학생을 모두 선택해주세요.");
      return;
    }
    setError(null);
    setSuccess(null);
    setOcrBusy(true);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("assignmentRoundId", round.id);
      form.append("studentId", studentId);
      const provider = getPreferredProvider();
      form.append("provider", provider);

      const res = await fetch("/api/analyze/ocr", {
        method: "POST",
        body: form,
        headers: buildAIHeaders(provider),
      });
      const body: ApiResp<OcrApiResult> = await res.json();
      if (!body.success || !body.data) {
        setError(body.error || "인식 실패");
        return;
      }
      setOcr(body.data);
      setText(body.data.fullText);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setOcrBusy(false);
    }
  }

  async function save(action: "SAVE_DRAFT" | "SUBMIT") {
    if (!round || !studentId || !ocr) return;
    if (action === "SUBMIT" && assignment?.minChars) {
      const cc = [...text].length;
      if (cc < assignment.minChars) {
        setError(`최소 ${assignment.minChars}자 이상이어야 제출돼요. (지금 ${cc}자)`);
        return;
      }
    }
    setSaveBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/submissions/teacher", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentRoundId: round.id,
          studentId,
          text,
          action,
          ocr: {
            imageUrl: ocr.imageUrl,
            ocrRawText: ocr.fullText,
            confidence: ocr.overallConfidence,
            aiProvider: ocr.aiProvider,
            segments: ocr.segments,
            corrections: [],
          },
        }),
      });
      const body: ApiResp<{ id: string; status: string }> = await res.json();
      if (!body.success) {
        setError(body.error || "저장 실패");
        return;
      }
      setSuccess(action === "SUBMIT" ? "제출 완료!" : "임시저장 완료");
    } finally {
      setSaveBusy(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    void runOcr(f);
    e.target.value = "";
  }

  const charCount = [...text].length;
  const canSave = !!ocr && !!studentId && !!round && !saveBusy;

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 md:grid-cols-2">
        <FilterSelect
          label="학생"
          value={studentId}
          onChange={onStudentChange}
          options={students.map((s) => ({
            value: s.id,
            label: `${s.number}번 ${s.name}`,
          }))}
          disabled={students.length === 0}
          empty={students.length === 0 ? "등록된 학생이 없어요" : undefined}
        />
        <div className="flex flex-col justify-end">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={onPickFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={ocrBusy || !studentId || !round}
            className="btn-primary"
          >
            {ocrBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {ocrBusy ? "인식 중…" : ocr ? "다른 사진으로 다시 인식" : "사진 업로드"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-teal/10 px-3 py-2 text-sm text-teal-700">
          {success}
        </p>
      )}

      {ocr && (
        <>
          <div className="card">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>
                인식 신뢰도{" "}
                <strong className="text-gray-800">
                  {Math.round(ocr.overallConfidence * 100)}%
                </strong>{" "}
                · {ocr.aiProvider}
              </span>
              <a
                href={ocr.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-area-structure hover:underline"
              >
                원본 이미지 보기
              </a>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="block w-full min-h-[40vh] resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm leading-relaxed focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <p className="mt-2 text-xs text-gray-500">
              {charCount}자
              {assignment?.minChars && ` / 최소 ${assignment.minChars}자`}
            </p>
            {ocr.lowConfidenceWords.length > 0 && (
              <details className="mt-2 rounded-md bg-bg-subtle p-2 text-xs">
                <summary className="cursor-pointer text-area-grammar">
                  확신이 낮은 글자 {ocr.lowConfidenceWords.length}개 확인
                </summary>
                <ul className="mt-1 list-disc pl-4 text-gray-700">
                  {ocr.lowConfidenceWords.map((w, i) => (
                    <li key={i}>
                      <span className="font-medium">{w.original}</span>
                      {w.candidates.length > 0 && (
                        <span className="ml-1 text-gray-500">
                          → {w.candidates.join(", ")}
                        </span>
                      )}
                      {w.reason && (
                        <span className="ml-1 text-gray-400">({w.reason})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save("SAVE_DRAFT")}
              disabled={!canSave}
              className="btn-secondary flex-1"
            >
              <Save className="h-4 w-4" />
              임시저장
            </button>
            <button
              type="button"
              onClick={() => void save("SUBMIT")}
              disabled={!canSave}
              className="btn-primary flex-1"
            >
              <Send className="h-4 w-4" />
              제출하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────
// 일괄 모드
// ────────────────────────────────────────

function BulkMode({
  students,
  round,
  assignment,
}: {
  students: OcrStudent[];
  round: OcrRound | null;
  assignment: OcrAssignment | null;
}) {
  const [items, setItems] = useState<BulkItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (fs.length === 0) return;
    const newItems: BulkItem[] = fs.map((f) => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      studentId: null,
      ocr: null,
      editedText: "",
      status: "idle",
    }));
    setItems((prev) => [...prev, ...newItems]);
  }

  function patch(localId: string, patch: Partial<BulkItem>) {
    setItems((prev) =>
      prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it))
    );
  }

  function remove(localId: string) {
    setItems((prev) => {
      const it = prev.find((x) => x.localId === localId);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.localId !== localId);
    });
  }

  async function runOcrOne(it: BulkItem) {
    if (!round) {
      setGlobalError("회차를 먼저 선택해주세요.");
      return;
    }
    if (!it.studentId) {
      patch(it.localId, { status: "error", errorMsg: "학생을 먼저 매칭해주세요." });
      return;
    }
    patch(it.localId, { status: "ocring", errorMsg: undefined });
    try {
      const form = new FormData();
      form.append("image", it.file);
      form.append("assignmentRoundId", round.id);
      form.append("studentId", it.studentId);
      const provider = getPreferredProvider();
      form.append("provider", provider);

      const res = await fetch("/api/analyze/ocr", {
        method: "POST",
        body: form,
        headers: buildAIHeaders(provider),
      });
      const body: ApiResp<OcrApiResult> = await res.json();
      if (!body.success || !body.data) {
        patch(it.localId, { status: "error", errorMsg: body.error || "인식 실패" });
        return;
      }
      patch(it.localId, {
        status: "ready",
        ocr: body.data,
        editedText: body.data.fullText,
      });
    } catch (e) {
      patch(it.localId, {
        status: "error",
        errorMsg: e instanceof Error ? e.message : "네트워크 오류",
      });
    }
  }

  async function saveOne(it: BulkItem, action: "SAVE_DRAFT" | "SUBMIT") {
    if (!round || !it.ocr || !it.studentId) return;
    if (action === "SUBMIT" && assignment?.minChars) {
      const cc = [...it.editedText].length;
      if (cc < assignment.minChars) {
        patch(it.localId, {
          status: "error",
          errorMsg: `최소 ${assignment.minChars}자 이상이어야 제출돼요. (지금 ${cc}자)`,
        });
        return;
      }
    }
    patch(it.localId, { status: "saving", errorMsg: undefined });
    try {
      const res = await fetch("/api/submissions/teacher", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentRoundId: round.id,
          studentId: it.studentId,
          text: it.editedText,
          action,
          ocr: {
            imageUrl: it.ocr.imageUrl,
            ocrRawText: it.ocr.fullText,
            confidence: it.ocr.overallConfidence,
            aiProvider: it.ocr.aiProvider,
            segments: it.ocr.segments,
            corrections: [],
          },
        }),
      });
      const body: ApiResp<{ id: string }> = await res.json();
      if (!body.success) {
        patch(it.localId, { status: "error", errorMsg: body.error || "저장 실패" });
        return;
      }
      patch(it.localId, { status: "saved" });
    } catch (e) {
      patch(it.localId, {
        status: "error",
        errorMsg: e instanceof Error ? e.message : "네트워크 오류",
      });
    }
  }

  async function runAll() {
    for (const it of items) {
      if (it.status === "idle" || it.status === "error") {
        await runOcrOne(it);
      }
    }
  }

  // 학생 자동 후보 — 아직 사용되지 않은 학생만 dropdown 강조
  const usedStudentIds = new Set(items.map((i) => i.studentId).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={onPickFiles}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!round}
          className="btn-secondary"
        >
          <Camera className="h-4 w-4" /> 사진 여러 장 선택
        </button>
        <button
          type="button"
          onClick={() => void runAll()}
          disabled={!round || items.length === 0}
          className="btn-primary"
        >
          <Sparkles className="h-4 w-4" /> 전체 인식 실행
        </button>
        <span className="text-xs text-gray-500">
          올린 사진: {items.length}장 · 인식 완료:{" "}
          {items.filter((i) => i.ocr).length}장
        </span>
      </div>

      {globalError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {globalError}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">사진을 한 번에 여러 장 올려주세요.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.localId} className="card">
              <div className="flex gap-4">
                {/* 썸네일 */}
                <div className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.previewUrl}
                    alt="업로드 미리보기"
                    className="h-28 w-28 rounded-lg border border-gray-200 object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={it.studentId ?? ""}
                      onChange={(e) =>
                        patch(it.localId, { studentId: e.target.value || null })
                      }
                      className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                    >
                      <option value="">학생 선택</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.number}번 {s.name}
                          {usedStudentIds.has(s.id) && s.id !== it.studentId
                            ? " (중복)"
                            : ""}
                        </option>
                      ))}
                    </select>
                    <StatusChip status={it.status} />
                    <button
                      type="button"
                      onClick={() => remove(it.localId)}
                      className="ml-auto text-xs text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="inline h-3.5 w-3.5" /> 삭제
                    </button>
                  </div>

                  {it.errorMsg && (
                    <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                      {it.errorMsg}
                    </p>
                  )}

                  {it.ocr ? (
                    <>
                      <textarea
                        value={it.editedText}
                        onChange={(e) =>
                          patch(it.localId, { editedText: e.target.value })
                        }
                        className="block w-full min-h-[16ch] resize-y rounded-md border border-gray-200 p-2 text-sm leading-relaxed focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                      />
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          신뢰도{" "}
                          {Math.round(it.ocr.overallConfidence * 100)}% ·{" "}
                          {[...it.editedText].length}자
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveOne(it, "SAVE_DRAFT")}
                            disabled={it.status === "saving" || it.status === "saved"}
                            className="btn-secondary text-xs"
                          >
                            <Save className="h-3 w-3" /> 임시저장
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveOne(it, "SUBMIT")}
                            disabled={it.status === "saving" || it.status === "saved"}
                            className="btn-primary text-xs"
                          >
                            <Send className="h-3 w-3" /> 제출
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void runOcrOne(it)}
                      disabled={it.status === "ocring" || !it.studentId || !round}
                      className="btn-primary text-xs"
                    >
                      {it.status === "ocring" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      이 사진 인식
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ────────────────────────────────────────
// 작은 부품
// ────────────────────────────────────────

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition " +
        (active
          ? "bg-teal text-white shadow"
          : "text-gray-600 hover:bg-gray-50")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  empty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  empty?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {options.length === 0 ? (
        <p className="mt-1 rounded-md border border-dashed border-gray-200 bg-bg-subtle px-3 py-2 text-xs text-gray-500">
          {empty ?? "선택 가능한 항목이 없어요"}
        </p>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:bg-gray-50"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

function StatusChip({ status }: { status: BulkItem["status"] }) {
  const map: Record<BulkItem["status"], { label: string; cls: string; icon?: React.ReactNode }> = {
    idle: { label: "대기", cls: "bg-gray-100 text-gray-600" },
    ocring: {
      label: "인식중",
      cls: "bg-area-structure/10 text-area-structure",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    ready: { label: "확인 대기", cls: "bg-area-expression/10 text-area-expression" },
    saving: {
      label: "저장중",
      cls: "bg-area-structure/10 text-area-structure",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    saved: {
      label: "저장됨",
      cls: "bg-teal/10 text-teal",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    error: { label: "오류", cls: "bg-red-50 text-red-700" },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}
