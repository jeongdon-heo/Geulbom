// ============================================================
// 성장 분석 · 뱃지 유틸 (순수 함수)
// - Feedback 시계열을 받아 차트 데이터 / 인사이트 / 뱃지 계산
// - 루브릭이 동적이므로 영역 키는 rubricAreas로 주입
// ============================================================

export interface RubricArea {
  key: string;
  name: string;
  maxScore: number;
  description?: string;
}

export interface FeedbackPoint {
  /** 회차 번호 (시간순 정렬 키) */
  roundNumber: number;
  /** 과제 제목 */
  assignmentTitle: string;
  /** 회차 마감일 또는 승인일 (ISO 문자열) — 화면 라벨용 */
  date: string;
  /** 영역별 점수 (key는 rubric area key) */
  scores: Record<string, number>;
  /** AI/교사가 산정한 총점 */
  totalScore: number;
  /** APPROVED 여부 (학생용에서는 항상 true만 들어옴) */
  approved: boolean;
}

export interface TimelineRow {
  roundNumber: number;
  label: string; // "5회차"
  date: string;
  total: number;
  // 영역별 점수도 같은 행에 넣어 단일 데이터셋으로 멀티 라인 사용 가능
  [areaKey: string]: number | string;
}

export interface AreaInsight {
  areaKey: string;
  areaName: string;
  /** 최근 점수 - 첫 점수 (양수면 성장) */
  delta: number;
  /** 가장 최근 점수 */
  latest: number;
  /** 평균 */
  average: number;
}

export interface BadgeStatus {
  key: string;
  label: string;
  description: string;
  achieved: boolean;
  /** 진척도 0~1 (achieved=true면 1) */
  progress: number;
  /** 사람이 읽을 진척 문자열 (예: "7 / 10편") */
  progressLabel?: string;
  /** 달성 회차 (있을 때) */
  achievedAtRound?: number;
}

export interface GrowthAnalysis {
  /** 시간순 정렬된 차트용 데이터 */
  timeline: TimelineRow[];
  /** 영역별 통계 */
  areaInsights: AreaInsight[];
  /** 가장 성장한 영역 (delta 최대) */
  mostGrown: AreaInsight | null;
  /** 정체된 영역 (delta 최소, 음수 포함) */
  mostStagnant: AreaInsight | null;
  /** 최근 5회 평균 총점 */
  recentAverageTotal: number | null;
  /** 첫 회 대비 총점 변화 */
  totalDelta: number | null;
  /** 분석에 사용된 데이터 개수 */
  count: number;
}

/**
 * Feedback 시계열을 받아 성장 분석을 계산합니다.
 * - feedbacks는 시간순일 필요 없음. 내부에서 roundNumber asc 정렬.
 * - rubricAreas는 차트의 영역 키 매핑에 사용. 없으면 빈 분석.
 */
export function analyzeGrowth(
  feedbacks: FeedbackPoint[],
  rubricAreas: RubricArea[]
): GrowthAnalysis {
  const sorted = [...feedbacks].sort((a, b) => a.roundNumber - b.roundNumber);
  const count = sorted.length;

  // ── timeline (Recharts 데이터) ──
  const timeline: TimelineRow[] = sorted.map((p) => {
    const row: TimelineRow = {
      roundNumber: p.roundNumber,
      label: `${p.roundNumber}회차`,
      date: p.date,
      total: p.totalScore,
    };
    for (const a of rubricAreas) {
      row[a.key] = p.scores[a.key] ?? 0;
    }
    return row;
  });

  // ── 영역별 통계 ──
  const areaInsights: AreaInsight[] = rubricAreas.map((area) => {
    const values = sorted
      .map((p) => p.scores[area.key])
      .filter((v): v is number => typeof v === "number");
    if (values.length === 0) {
      return {
        areaKey: area.key,
        areaName: area.name,
        delta: 0,
        latest: 0,
        average: 0,
      };
    }
    const first = values[0];
    const last = values[values.length - 1];
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    return {
      areaKey: area.key,
      areaName: area.name,
      delta: last - first,
      latest: last,
      average: Math.round(avg * 10) / 10,
    };
  });

  // ── 가장 성장 / 정체 ──
  let mostGrown: AreaInsight | null = null;
  let mostStagnant: AreaInsight | null = null;
  if (count >= 2 && areaInsights.length > 0) {
    mostGrown = areaInsights.reduce((a, b) => (b.delta > a.delta ? b : a));
    mostStagnant = areaInsights.reduce((a, b) => (b.delta < a.delta ? b : a));
  }

  // ── 총점 통계 ──
  const totals = sorted.map((p) => p.totalScore);
  const recentSlice = totals.slice(-5);
  const recentAverageTotal =
    recentSlice.length > 0
      ? Math.round(
          (recentSlice.reduce((s, v) => s + v, 0) / recentSlice.length) * 10
        ) / 10
      : null;
  const totalDelta =
    totals.length >= 2 ? totals[totals.length - 1] - totals[0] : null;

  return {
    timeline,
    areaInsights,
    mostGrown,
    mostStagnant,
    recentAverageTotal,
    totalDelta,
    count,
  };
}

// ────────────────────────────────────────
// 뱃지
// ────────────────────────────────────────

interface BadgeDef {
  key: string;
  label: string;
  description: string;
  /** 매칭에 사용할 영역 키 후보 (첫 매칭 우선) */
  areaKeyCandidates?: string[];
  /** 뱃지 평가 함수 — 달성 여부 + 진척 반환 */
  evaluate: (
    feedbacks: FeedbackPoint[],
    rubricAreas: RubricArea[]
  ) => Pick<BadgeStatus, "achieved" | "progress" | "progressLabel" | "achievedAtRound">;
}

function findAreaKey(rubricAreas: RubricArea[], candidates: string[]): string | null {
  for (const c of candidates) {
    if (rubricAreas.some((a) => a.key === c)) return c;
  }
  return null;
}

/** SPEC 기본 뱃지 4종 */
export const DEFAULT_BADGES: BadgeDef[] = [
  {
    key: "consistent_writer",
    label: "꾸준히 글쟁이",
    description: "공개된 글 10편 달성",
    evaluate: (fbs) => {
      const n = fbs.length;
      const target = 10;
      if (n >= target) {
        const sorted = [...fbs].sort((a, b) => a.roundNumber - b.roundNumber);
        return {
          achieved: true,
          progress: 1,
          progressLabel: `${n} / ${target}편`,
          achievedAtRound: sorted[target - 1]?.roundNumber,
        };
      }
      return {
        achieved: false,
        progress: n / target,
        progressLabel: `${n} / ${target}편`,
      };
    },
  },
  {
    key: "rapid_growth",
    label: "쑥쑥 성장",
    description: "첫 글 대비 총점 +10점 이상",
    evaluate: (fbs) => {
      if (fbs.length < 2) {
        return { achieved: false, progress: 0, progressLabel: "글이 2편 이상 있어야 해요" };
      }
      const sorted = [...fbs].sort((a, b) => a.roundNumber - b.roundNumber);
      const first = sorted[0].totalScore;
      const best = sorted.reduce((maxRow, row) =>
        row.totalScore > maxRow.totalScore ? row : maxRow
      );
      const delta = best.totalScore - first;
      const target = 10;
      if (delta >= target) {
        return {
          achieved: true,
          progress: 1,
          progressLabel: `+${delta}점`,
          achievedAtRound: best.roundNumber,
        };
      }
      return {
        achieved: false,
        progress: Math.max(0, delta) / target,
        progressLabel: delta >= 0 ? `+${delta}점 / +${target}점` : `${delta}점`,
      };
    },
  },
  {
    key: "expression_master",
    label: "표현의 달인",
    description: "표현 영역 15점 이상 달성",
    areaKeyCandidates: ["expression"],
    evaluate: (fbs, areas) => {
      const key = findAreaKey(areas, ["expression"]);
      if (!key) return { achieved: false, progress: 0, progressLabel: "표현 영역 없음" };
      const target = 15;
      const sorted = [...fbs].sort((a, b) => a.roundNumber - b.roundNumber);
      const hit = sorted.find((p) => (p.scores[key] ?? 0) >= target);
      if (hit) {
        return {
          achieved: true,
          progress: 1,
          progressLabel: `${target}점 달성!`,
          achievedAtRound: hit.roundNumber,
        };
      }
      const bestVal = sorted.reduce(
        (m, p) => Math.max(m, p.scores[key] ?? 0),
        0
      );
      return {
        achieved: false,
        progress: bestVal / target,
        progressLabel: `최고 ${bestVal} / ${target}점`,
      };
    },
  },
  {
    key: "spelling_master",
    label: "맞춤법 마스터",
    description: "맞춤법 영역 18점 이상 달성",
    areaKeyCandidates: ["grammar"],
    evaluate: (fbs, areas) => {
      const key = findAreaKey(areas, ["grammar"]);
      if (!key) return { achieved: false, progress: 0, progressLabel: "맞춤법 영역 없음" };
      const target = 18;
      const sorted = [...fbs].sort((a, b) => a.roundNumber - b.roundNumber);
      const hit = sorted.find((p) => (p.scores[key] ?? 0) >= target);
      if (hit) {
        return {
          achieved: true,
          progress: 1,
          progressLabel: `${target}점 달성!`,
          achievedAtRound: hit.roundNumber,
        };
      }
      const bestVal = sorted.reduce(
        (m, p) => Math.max(m, p.scores[key] ?? 0),
        0
      );
      return {
        achieved: false,
        progress: bestVal / target,
        progressLabel: `최고 ${bestVal} / ${target}점`,
      };
    },
  },
];

export function evaluateBadges(
  feedbacks: FeedbackPoint[],
  rubricAreas: RubricArea[]
): BadgeStatus[] {
  return DEFAULT_BADGES.map((b) => {
    const r = b.evaluate(feedbacks, rubricAreas);
    return {
      key: b.key,
      label: b.label,
      description: b.description,
      ...r,
    };
  });
}

// ────────────────────────────────────────
// 영역별 색상 (UI 일관성)
// SPEC 8장 색상 가이드 기반
// ────────────────────────────────────────

const AREA_COLOR_MAP: Record<string, string> = {
  content: "#1D9E75",
  structure: "#378ADD",
  expression: "#7F77DD",
  grammar: "#D85A30",
  volume: "#BA7517",
};

const FALLBACK_PALETTE = [
  "#1D9E75",
  "#378ADD",
  "#7F77DD",
  "#D85A30",
  "#BA7517",
  "#5C9B7A",
  "#A66B9F",
];

export function getAreaColor(areaKey: string, index = 0): string {
  return AREA_COLOR_MAP[areaKey] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}
