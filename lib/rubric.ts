// ============================================================
// 루브릭 공용 헬퍼
// ============================================================

import type { CreateRubricInput } from "./validations";

type Area = CreateRubricInput["areas"][number];
type ScoringGuide = NonNullable<CreateRubricInput["scoringGuide"]>;

/**
 * 채점 기준을 정리합니다.
 * - 현재 영역(areas)에 존재하는 키만 남깁니다.
 * - 상/중/하가 모두 비어 있는 영역은 제거합니다.
 * - 남는 항목이 없으면 null을 반환합니다.
 */
export function sanitizeScoringGuide(
  guide: ScoringGuide | null | undefined,
  areas: Area[]
): ScoringGuide | null {
  if (!guide) return null;
  const validKeys = new Set(areas.map((a) => a.key));
  const cleaned: ScoringGuide = {};

  for (const [key, entry] of Object.entries(guide)) {
    if (!validKeys.has(key)) continue;
    const high = entry.high?.trim() ?? "";
    const mid = entry.mid?.trim() ?? "";
    const low = entry.low?.trim() ?? "";
    if (!high && !mid && !low) continue;
    cleaned[key] = { high, mid, low };
  }

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}
