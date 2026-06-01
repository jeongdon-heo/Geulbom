// ============================================================
// 전문가 루브릭 프리셋 (초등 글쓰기)
// - '새 루브릭' 갤러리에서 선택하면 편집기에 자동으로 채워집니다.
// - 교사는 그대로 저장하거나 영역·배점·기준을 자유롭게 수정할 수 있습니다.
// - 화면 표시용 데이터일 뿐, DB와 무관합니다. (저장 시 '내 루브릭'으로 생성)
// ============================================================

import type { RubricArea, ScoringGuide, RubricView } from "./RubricManager";

export interface RubricPreset {
  id: string;
  genre: string; // 카드 상단 뱃지 (예: "일기 · 생활문")
  name: string; // 편집기에 채워질 기본 이름
  summary: string; // "이럴 때 쓰세요" 안내
  areas: RubricArea[];
  scoringGuide: ScoringGuide;
}

export const RUBRIC_PRESETS: RubricPreset[] = [
  // ── 1) 일기 · 생활문 ──
  {
    id: "diary_life",
    genre: "일기 · 생활문",
    name: "겪은 일 글쓰기 (일기·생활문)",
    summary: "겪은 일과 그때의 생각·느낌을 솔직하게 쓰는 글에 적합합니다. 매일 쓰는 일기나 주말 생활문에 추천해요.",
    areas: [
      {
        key: "content",
        name: "내용·솔직함",
        maxScore: 25,
        description: "겪은 일이 무엇인지 분명하고, 그때의 생각·느낌이 솔직하고 구체적으로 드러나는가",
      },
      {
        key: "structure",
        name: "구성",
        maxScore: 20,
        description: "처음-가운데-끝의 흐름이 자연스럽고, 하나의 사건을 중심으로 정리했는가",
      },
      {
        key: "expression",
        name: "표현",
        maxScore: 20,
        description: "생생한 묘사, 대화·감각 표현, 다양한 어휘를 사용해 장면이 떠오르게 썼는가",
      },
      {
        key: "grammar",
        name: "맞춤법·문장",
        maxScore: 20,
        description: "맞춤법·띄어쓰기가 정확하고, 문장의 주어와 서술어가 잘 호응하는가",
      },
      {
        key: "volume",
        name: "분량·성실함",
        maxScore: 15,
        description: "정해진 분량을 채우고, 대충 쓰지 않고 성의 있게 썼는가",
      },
    ],
    scoringGuide: {
      content: {
        high: "22~25: 겪은 일이 또렷하고, 생각·느낌이 자기 말로 구체적으로 표현됨",
        mid: "16~21: 겪은 일은 알겠으나 생각·느낌이 '재미있었다' 수준으로 단순함",
        low: "~15: 무슨 일이 있었는지 알기 어렵거나, 느낌이 거의 드러나지 않음",
      },
      structure: {
        high: "18~20: 처음-가운데-끝이 뚜렷하고 한 가지 사건에 집중함",
        mid: "14~17: 흐름은 있으나 여러 사건을 나열하거나 끝맺음이 약함",
        low: "~13: 시간순으로 사건만 나열, 글의 짜임이 잘 보이지 않음",
      },
      expression: {
        high: "18~20: 대화·감각·비유 표현이 2회 이상, 어휘가 다양하고 장면이 그려짐",
        mid: "14~17: 표현 시도는 있으나 단조롭고 비슷한 어휘가 반복됨",
        low: "~13: 거의 모든 문장이 '~했다'로 끝나고 표현이 밋밋함",
      },
      grammar: {
        high: "18~20: 맞춤법·띄어쓰기 오류 0~1개, 문장 호응이 자연스러움",
        mid: "14~17: 오류 2~5개, 읽는 데 큰 지장은 없음",
        low: "~13: 오류 6개 이상이거나 문장이 자주 어색함",
      },
      volume: {
        high: "13~15: 분량을 충분히 채우고 끝까지 성의 있게 씀",
        mid: "9~12: 기준은 채웠으나 조금 더 쓸 수 있었음",
        low: "~8: 분량이 많이 모자라거나 같은 말을 반복해 양만 채움",
      },
    },
  },

  // ── 2) 독후감 ──
  {
    id: "book_report",
    genre: "독후감",
    name: "독후감 평가표",
    summary: "책을 읽고 줄거리와 자신의 생각·느낌을 쓰는 글에 적합합니다. 책 이해와 감상의 깊이를 함께 봅니다.",
    areas: [
      {
        key: "comprehension",
        name: "책 이해",
        maxScore: 20,
        description: "책의 줄거리와 핵심 내용을 정확히 파악하고 자기 말로 정리했는가",
      },
      {
        key: "reflection",
        name: "생각과 느낌",
        maxScore: 25,
        description: "인상 깊은 부분에 대한 자신의 생각·느낌이 구체적이고 솔직하게 드러나는가",
      },
      {
        key: "connection",
        name: "근거·연결",
        maxScore: 20,
        description: "책 속 장면을 근거로 들거나, 자신의 경험·생각과 연결지어 썼는가",
      },
      {
        key: "structure",
        name: "구성",
        maxScore: 15,
        description: "책 소개-감상-마무리의 흐름이 자연스럽게 이어지는가",
      },
      {
        key: "expression",
        name: "표현·맞춤법",
        maxScore: 20,
        description: "어휘·문장 표현이 다양하고, 맞춤법·띄어쓰기가 정확한가",
      },
    ],
    scoringGuide: {
      comprehension: {
        high: "18~20: 핵심 내용을 정확히 이해하고 줄거리를 간결하게 정리함",
        mid: "14~17: 대체로 이해했으나 줄거리가 장황하거나 일부 부정확함",
        low: "~13: 책 내용을 잘못 이해했거나 줄거리만 길게 베껴 씀",
      },
      reflection: {
        high: "22~25: 인상 깊은 부분과 그 이유, 자기 생각이 구체적으로 드러남",
        mid: "16~21: 감상은 있으나 '재미있었다·감동적이었다' 수준으로 단순함",
        low: "~15: 생각·느낌이 거의 없고 줄거리 요약에 그침",
      },
      connection: {
        high: "18~20: 책 속 장면을 근거로 들거나 자기 경험과 자연스럽게 연결함",
        mid: "14~17: 연결 시도는 있으나 근거가 약하거나 막연함",
        low: "~13: 책 내용과 자기 생각의 연결이 거의 없음",
      },
      structure: {
        high: "13~15: 소개-감상-마무리 흐름이 뚜렷하고 짜임새가 있음",
        mid: "9~12: 흐름은 있으나 문단 구분이나 마무리가 약함",
        low: "~8: 생각나는 대로 나열되어 글의 짜임이 보이지 않음",
      },
      expression: {
        high: "18~20: 어휘가 다양하고 문장이 매끄러우며 맞춤법 오류 0~1개",
        mid: "14~17: 표현이 단조롭거나 맞춤법 오류 2~5개",
        low: "~13: 표현이 밋밋하고 맞춤법 오류가 6개 이상",
      },
    },
  },

  // ── 3) 주장하는 글 (논설문) ──
  {
    id: "argument",
    genre: "주장하는 글 · 논설문",
    name: "주장하는 글(논설문) 평가표",
    summary: "어떤 의견을 주장하고 근거로 설득하는 글에 적합합니다. 주장의 명확성과 근거의 타당성을 중점적으로 봅니다.",
    areas: [
      {
        key: "claim",
        name: "주장의 명확성",
        maxScore: 20,
        description: "주장하려는 의견이 분명하고, 글 전체에서 일관되게 유지되는가",
      },
      {
        key: "evidence",
        name: "근거의 타당성",
        maxScore: 30,
        description: "주장을 뒷받침하는 근거가 타당하고, 2가지 이상 충분히 제시되었는가",
      },
      {
        key: "structure",
        name: "구성(서론-본론-결론)",
        maxScore: 20,
        description: "서론에서 문제를 밝히고, 본론에서 근거를 들며, 결론에서 주장을 정리했는가",
      },
      {
        key: "persuasion",
        name: "설득력·표현",
        maxScore: 15,
        description: "읽는 이를 고려한 표현과 '왜냐하면·따라서' 같은 연결어를 적절히 사용했는가",
      },
      {
        key: "grammar",
        name: "맞춤법·문장",
        maxScore: 15,
        description: "맞춤법·띄어쓰기가 정확하고 문장이 명확한가",
      },
    ],
    scoringGuide: {
      claim: {
        high: "18~20: 주장이 한 문장으로 분명하고 글 끝까지 흔들리지 않음",
        mid: "14~17: 주장은 있으나 다소 막연하거나 중간에 흐려짐",
        low: "~13: 주장이 무엇인지 알기 어렵거나 여러 주장이 뒤섞임",
      },
      evidence: {
        high: "26~30: 타당한 근거 2개 이상, 예시·사실로 구체적으로 뒷받침함",
        mid: "19~25: 근거가 1~2개이나 막연하거나 주장과 연결이 약함",
        low: "~18: 근거가 거의 없거나 '내 생각엔'처럼 주장만 반복함",
      },
      structure: {
        high: "18~20: 서론-본론-결론이 뚜렷하고 문단이 잘 나뉨",
        mid: "14~17: 짜임은 있으나 결론이 약하거나 문단 구분이 흐림",
        low: "~13: 서론·결론 없이 생각나는 대로 나열함",
      },
      persuasion: {
        high: "13~15: 연결어를 알맞게 쓰고 읽는 이를 설득하려는 태도가 보임",
        mid: "9~12: 연결어 사용이 어색하거나 설득보다 단정에 그침",
        low: "~8: 연결어가 거의 없고 문장이 뚝뚝 끊김",
      },
      grammar: {
        high: "13~15: 맞춤법·띄어쓰기 오류 0~1개, 문장이 명확함",
        mid: "9~12: 오류 2~5개, 읽는 데 큰 지장은 없음",
        low: "~8: 오류가 6개 이상이거나 문장이 자주 모호함",
      },
    },
  },

  // ── 4) 설명하는 글 · 관찰 기록문 ──
  {
    id: "explanation",
    genre: "설명하는 글 · 관찰 기록문",
    name: "설명하는 글·관찰 기록문 평가표",
    summary: "어떤 대상을 정확히 설명하거나 관찰한 내용을 보고하는 글에 적합합니다. 정확성과 구체적 묘사를 함께 봅니다.",
    areas: [
      {
        key: "accuracy",
        name: "정확성",
        maxScore: 25,
        description: "설명하거나 관찰한 대상에 대한 정보가 정확하고 사실에 맞는가",
      },
      {
        key: "structure",
        name: "체계적 구성",
        maxScore: 20,
        description: "차례·기준(크기·색·순서 등)에 따라 짜임새 있게 설명했는가",
      },
      {
        key: "observation",
        name: "구체적 묘사·관찰",
        maxScore: 25,
        description: "관찰하거나 알아본 내용을 자세하고 구체적으로 표현했는가",
      },
      {
        key: "clarity",
        name: "이해하기 쉬운 표현",
        maxScore: 15,
        description: "읽는 이가 쉽게 이해하도록 풀어 쓰고, 어려운 말은 설명을 덧붙였는가",
      },
      {
        key: "grammar",
        name: "맞춤법·문장",
        maxScore: 15,
        description: "맞춤법·띄어쓰기가 정확하고 문장이 명확한가",
      },
    ],
    scoringGuide: {
      accuracy: {
        high: "22~25: 정보가 정확하고 사실에 맞으며, 잘못된 내용이 없음",
        mid: "16~21: 대체로 정확하나 일부 막연하거나 확인이 필요한 내용이 있음",
        low: "~15: 사실과 다른 내용이 많거나 추측만으로 설명함",
      },
      structure: {
        high: "18~20: 일정한 기준·차례에 따라 짜임새 있게 설명함",
        mid: "14~17: 순서는 있으나 기준이 흔들리거나 내용이 뒤섞임",
        low: "~13: 떠오르는 대로 나열되어 설명의 순서가 보이지 않음",
      },
      observation: {
        high: "22~25: 모양·색·크기·변화 등을 자세하고 구체적으로 묘사함",
        mid: "16~21: 묘사는 있으나 두루뭉술하거나 항목이 적음",
        low: "~15: '예쁘다·크다'처럼 막연하고 구체적 관찰이 거의 없음",
      },
      clarity: {
        high: "13~15: 읽는 이가 쉽게 이해하도록 풀어 쓰고 어려운 말을 설명함",
        mid: "9~12: 대체로 이해되나 일부 표현이 어렵거나 설명이 부족함",
        low: "~8: 무슨 뜻인지 알기 어려운 문장이 많음",
      },
      grammar: {
        high: "13~15: 맞춤법·띄어쓰기 오류 0~1개, 문장이 명확함",
        mid: "9~12: 오류 2~5개, 읽는 데 큰 지장은 없음",
        low: "~8: 오류가 6개 이상이거나 문장이 자주 어색함",
      },
    },
  },
];

/** 프리셋을 편집기(RubricEditor)가 받는 RubricView 형태로 변환합니다. */
export function presetToRubricView(p: RubricPreset): RubricView {
  const totalScore = p.areas.reduce((sum, a) => sum + a.maxScore, 0);
  return {
    id: `preset:${p.id}`, // create 모드에서는 사용되지 않는 임시 id
    name: p.name,
    totalScore,
    areas: p.areas,
    scoringGuide: p.scoringGuide,
    usageCount: 0,
    isOwner: true,
    isShared: false,
    ownerName: "나",
  };
}
