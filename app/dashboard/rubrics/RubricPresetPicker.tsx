"use client";

import { FilePlus2, Sparkles, X } from "lucide-react";
import { RUBRIC_PRESETS, type RubricPreset } from "./presets";

/**
 * 새 루브릭을 만들 때 보여주는 전문가 템플릿 갤러리.
 * - 템플릿을 고르면 편집기에 내용이 채워진 채로 열립니다.
 * - "빈 양식으로 시작"을 고르면 기존처럼 빈 편집기가 열립니다.
 */
export function RubricPresetPicker({
  onPickPreset,
  onPickBlank,
  onCancel,
}: {
  onPickPreset: (preset: RubricPreset) => void;
  onPickBlank: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-bold text-gray-900">
            <Sparkles className="h-5 w-5 text-teal-600" />새 루브릭 만들기
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            전문가가 만든 템플릿을 고르면 영역·배점·채점 기준이 자동으로 채워집니다.
            그대로 저장하거나 자유롭게 수정할 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title="닫기"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {RUBRIC_PRESETS.map((preset) => {
          const total = preset.areas.reduce((s, a) => s + a.maxScore, 0);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPickPreset(preset)}
              className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-teal-400 hover:bg-teal-50/40 hover:shadow-sm"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                  {preset.genre}
                </span>
                <span className="shrink-0 text-xs text-gray-400">총 {total}점</span>
              </div>
              <h3 className="font-bold text-gray-900 group-hover:text-teal-800">
                {preset.name}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{preset.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {preset.areas.map((a) => (
                  <span
                    key={a.key}
                    className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
                  >
                    {a.name} {a.maxScore}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onPickBlank}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FilePlus2 className="h-4 w-4" />
          빈 양식으로 직접 만들기
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
        >
          취소
        </button>
      </div>
    </div>
  );
}
