"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, X } from "lucide-react";
import type { RubricArea, RubricView, ScoringGuide } from "./RubricManager";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 편집 중 영역 상태 (채점 기준을 영역에 인라인으로 보관)
interface EditorArea {
  key: string;
  name: string;
  maxScore: number;
  description: string;
  guideHigh: string;
  guideMid: string;
  guideLow: string;
  showGuide: boolean;
}

type Mode = "create" | "edit" | "duplicate";

function toEditorAreas(rubric: RubricView | null): EditorArea[] {
  if (!rubric || rubric.areas.length === 0) {
    return [blankArea(1)];
  }
  return rubric.areas.map((a) => {
    const g = rubric.scoringGuide?.[a.key];
    return {
      key: a.key,
      name: a.name,
      maxScore: a.maxScore,
      description: a.description,
      guideHigh: g?.high ?? "",
      guideMid: g?.mid ?? "",
      guideLow: g?.low ?? "",
      showGuide: !!(g && (g.high || g.mid || g.low)),
    };
  });
}

function blankArea(n: number): EditorArea {
  return {
    key: `area_${n}_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    maxScore: 20,
    description: "",
    guideHigh: "",
    guideMid: "",
    guideLow: "",
    showGuide: false,
  };
}

export function RubricEditor({
  mode,
  rubric,
  onSaved,
  onCancel,
}: {
  mode: Mode;
  rubric: RubricView | null;
  onSaved: (r: RubricView) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(
    mode === "duplicate" ? `${rubric?.name ?? ""} (복사본)` : rubric?.name ?? ""
  );
  const [areas, setAreas] = useState<EditorArea[]>(() => toEditorAreas(rubric));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalScore = useMemo(
    () => areas.reduce((sum, a) => sum + (Number.isFinite(a.maxScore) ? a.maxScore : 0), 0),
    [areas]
  );

  function updateArea(idx: number, patch: Partial<EditorArea>) {
    setAreas((arr) => arr.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function addArea() {
    setAreas((arr) => [...arr, blankArea(arr.length + 1)]);
  }

  function removeArea(idx: number) {
    setAreas((arr) => (arr.length <= 1 ? arr : arr.filter((_, i) => i !== idx)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("루브릭 이름을 입력해주세요.");
    if (areas.some((a) => !a.name.trim()))
      return setError("모든 영역에 이름을 입력해주세요.");
    if (areas.some((a) => !a.description.trim()))
      return setError("모든 영역에 설명을 입력해주세요.");
    if (areas.some((a) => !Number.isInteger(a.maxScore) || a.maxScore < 1))
      return setError("배점은 1점 이상의 정수여야 합니다.");

    // 페이로드 구성
    const payloadAreas: RubricArea[] = areas.map((a) => ({
      key: a.key,
      name: a.name.trim(),
      maxScore: a.maxScore,
      description: a.description.trim(),
    }));

    const scoringGuide: ScoringGuide = {};
    for (const a of areas) {
      const high = a.guideHigh.trim();
      const mid = a.guideMid.trim();
      const low = a.guideLow.trim();
      if (high || mid || low) scoringGuide[a.key] = { high, mid, low };
    }

    const body = {
      name: name.trim(),
      areas: payloadAreas,
      scoringGuide: Object.keys(scoringGuide).length > 0 ? scoringGuide : null,
    };

    setSaving(true);
    const isEdit = mode === "edit" && rubric;
    const res = await fetch(isEdit ? `/api/rubrics/${rubric!.id}` : "/api/rubrics", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: ApiResp<{
      id: string;
      name: string;
      totalScore: number;
      areas: RubricArea[];
      scoringGuide: ScoringGuide | null;
    }> = await res.json();
    setSaving(false);

    if (!json.success || !json.data) {
      setError(json.error || "저장에 실패했습니다.");
      return;
    }

    onSaved({
      id: json.data.id,
      name: json.data.name,
      totalScore: json.data.totalScore,
      areas: json.data.areas ?? payloadAreas,
      scoringGuide: json.data.scoringGuide ?? null,
      usageCount: isEdit ? rubric!.usageCount : 0,
      isOwner: true,
      isShared: false,
      ownerName: "나",
    });
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          {mode === "edit" ? "루브릭 수정" : mode === "duplicate" ? "루브릭 복제" : "새 루브릭"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title="닫기"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 이름 + 총점 */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            루브릭 이름
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="예: 독후감 평가표"
            maxLength={100}
          />
        </div>
        <div className="rounded-lg bg-teal-50 px-4 py-2.5 text-center">
          <p className="text-xs text-teal-700">총점</p>
          <p className="text-xl font-bold text-teal-700">{totalScore}점</p>
        </div>
      </div>

      {/* 영역 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            평가 영역 ({areas.length})
          </p>
          <button
            type="button"
            onClick={addArea}
            disabled={areas.length >= 10}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            영역 추가
          </button>
        </div>

        {areas.map((area, idx) => (
          <div key={area.key} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <div className="grid gap-2 sm:grid-cols-[auto_1fr_110px_auto] sm:items-center">
              <GripVertical className="hidden h-4 w-4 text-gray-300 sm:block" />
              <input
                value={area.name}
                onChange={(e) => updateArea(idx, { name: e.target.value })}
                className="input"
                placeholder="영역 이름 (예: 내용)"
                maxLength={40}
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={area.maxScore}
                  onChange={(e) => updateArea(idx, { maxScore: Number(e.target.value) })}
                  className="input"
                  placeholder="배점"
                />
                <span className="text-sm text-gray-500">점</span>
              </div>
              <button
                type="button"
                onClick={() => removeArea(idx)}
                disabled={areas.length <= 1}
                className="justify-self-end rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                title="영역 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={area.description}
              onChange={(e) => updateArea(idx, { description: e.target.value })}
              className="input mt-2 min-h-[44px] text-sm"
              placeholder="이 영역에서 무엇을 평가하나요? (예: 주제에 맞는 내용을 풍부하게 썼는가)"
              maxLength={500}
            />

            {/* 채점 기준 (선택) */}
            <button
              type="button"
              onClick={() => updateArea(idx, { showGuide: !area.showGuide })}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              {area.showGuide ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              채점 기준 (상/중/하) {area.showGuide ? "접기" : "추가"}
            </button>

            {area.showGuide && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <GuideField
                  label="상"
                  value={area.guideHigh}
                  onChange={(v) => updateArea(idx, { guideHigh: v })}
                />
                <GuideField
                  label="중"
                  value={area.guideMid}
                  onChange={(v) => updateArea(idx, { guideMid: v })}
                />
                <GuideField
                  label="하"
                  value={area.guideLow}
                  onChange={(v) => updateArea(idx, { guideLow: v })}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

function GuideField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input min-h-[60px] text-xs"
        placeholder={`${label} 수준 기준`}
        maxLength={500}
      />
    </div>
  );
}
