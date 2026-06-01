"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Plus, Trash2, Lock } from "lucide-react";
import { RubricEditor } from "./RubricEditor";
import { RubricPresetPicker } from "./RubricPresetPicker";
import { presetToRubricView } from "./presets";

// ── 공용 타입 ──

export interface RubricArea {
  key: string;
  name: string;
  maxScore: number;
  description: string;
}

export interface ScoringGuide {
  [areaKey: string]: { high: string; mid: string; low: string };
}

export interface RubricView {
  id: string;
  name: string;
  totalScore: number;
  areas: RubricArea[];
  scoringGuide: ScoringGuide | null;
  usageCount: number;
  isOwner: boolean;
  isShared: boolean; // 공용(admin) 루브릭이며 내 소유가 아님
  ownerName: string;
}

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type EditorState =
  | { open: false }
  | { open: true; phase: "pick" } // 전문가 템플릿 갤러리
  | { open: true; phase: "edit"; mode: "create" | "edit" | "duplicate"; rubric: RubricView | null };

export function RubricManager({ initial }: { initial: RubricView[] }) {
  const router = useRouter();
  const [rubrics, setRubrics] = useState<RubricView[]>(initial);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [error, setError] = useState<string | null>(null);

  function onSaved(saved: RubricView) {
    setRubrics((arr) => {
      const exists = arr.some((r) => r.id === saved.id);
      return exists ? arr.map((r) => (r.id === saved.id ? saved : r)) : [...arr, saved];
    });
    setEditor({ open: false });
    router.refresh();
  }

  async function onDelete(r: RubricView) {
    setError(null);
    if (!confirm(`'${r.name}' 루브릭을 삭제할까요?`)) return;
    const res = await fetch(`/api/rubrics/${r.id}`, { method: "DELETE" });
    const json: ApiResp<unknown> = await res.json();
    if (!json.success) {
      setError(json.error || "삭제에 실패했습니다.");
      return;
    }
    setRubrics((arr) => arr.filter((x) => x.id !== r.id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!editor.open && (
        <div className="flex justify-end">
          <button
            onClick={() => setEditor({ open: true, phase: "pick" })}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />새 루브릭
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {editor.open && editor.phase === "pick" && (
        <RubricPresetPicker
          onPickPreset={(preset) =>
            setEditor({
              open: true,
              phase: "edit",
              mode: "create",
              rubric: presetToRubricView(preset),
            })
          }
          onPickBlank={() =>
            setEditor({ open: true, phase: "edit", mode: "create", rubric: null })
          }
          onCancel={() => setEditor({ open: false })}
        />
      )}

      {editor.open && editor.phase === "edit" && (
        <RubricEditor
          mode={editor.mode}
          rubric={editor.rubric}
          onSaved={onSaved}
          onCancel={() => setEditor({ open: false })}
        />
      )}

      {/* 루브릭 목록 */}
      {!editor.open && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rubrics.map((r) => (
            <div key={r.id} className="card flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900">{r.name}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {r.isShared ? (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" /> 공용 · {r.ownerName}
                      </span>
                    ) : (
                      <>내 루브릭</>
                    )}
                    {r.usageCount > 0 && ` · 과제 ${r.usageCount}개에서 사용 중`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                  총 {r.totalScore}점
                </span>
              </div>

              {/* 영역 미리보기 */}
              <ul className="mb-3 flex-1 space-y-1">
                {r.areas.map((a) => (
                  <li
                    key={a.key}
                    className="flex items-center justify-between text-sm text-gray-700"
                  >
                    <span className="truncate">{a.name}</span>
                    <span className="ml-2 shrink-0 text-xs text-gray-400">{a.maxScore}점</span>
                  </li>
                ))}
              </ul>

              {/* 액션 */}
              <div className="flex items-center justify-end gap-1 border-t border-gray-100 pt-2">
                <button
                  onClick={() => setEditor({ open: true, phase: "edit", mode: "duplicate", rubric: r })}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  title="복제하여 새로 만들기"
                >
                  <Copy className="h-4 w-4" />
                  복제
                </button>
                {r.isOwner && (
                  <>
                    <button
                      onClick={() => setEditor({ open: true, phase: "edit", mode: "edit", rubric: r })}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      수정
                    </button>
                    <button
                      onClick={() => onDelete(r)}
                      disabled={r.usageCount > 0}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                      title={r.usageCount > 0 ? "사용 중인 루브릭은 삭제할 수 없습니다." : "삭제"}
                    >
                      <Trash2 className="h-4 w-4" />
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
