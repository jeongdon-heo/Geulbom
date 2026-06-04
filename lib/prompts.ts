// ============================================================
// 글봄 (GeulBom) — AI 프롬프트 설계
// 동적 루브릭 기반 · Gemini/Claude 공용
// ============================================================

// ────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────

interface RubricArea {
  key: string;       // "content", "structure", ...
  name: string;      // "내용", "구성", ...
  maxScore: number;  // 20
  description: string;
}

interface ScoringGuide {
  [areaKey: string]: {
    high: string;  // "18~20: ..."
    mid: string;   // "13~17: ..."
    low: string;   // "~12: ..."
  };
}

interface PreviousScore {
  [areaKey: string]: number;
}

interface WritingHistory {
  roundNumber: number;
  title: string | null;
  date: string;
  scores: { [areaKey: string]: number };
  totalScore: number;
  textPreview: string; // 앞 200자
}

// ============================================================
// 1. OCR 프롬프트 — 손글씨 → 텍스트
// ============================================================

export function buildOcrPrompt(): string {
  return `당신은 대한민국 초등학생의 손글씨를 인식하는 전문가입니다.
이미지에서 학생이 손으로 쓴 글을 텍스트로 변환해주세요.

## 규칙

1. 학생이 쓴 그대로 변환하세요. 맞춤법이 틀려도 고치지 마세요.
2. 줄바꿈은 문장 단위로 정리하되, 원본의 의미 구분을 유지하세요.
3. 읽기 어려운 부분은 최대한 추측하되, 확신도를 낮게 표시하세요.
4. 확신도 기준:
   - 0.85 이상: 확실히 읽힘
   - 0.70~0.84: 읽히지만 다른 글자일 가능성 있음
   - 0.70 미만: 불확실, 추측에 가까움

## 응답 형식

반드시 아래 JSON만 출력하세요. 다른 텍스트나 마크다운 없이 JSON만 응답합니다.

{
  "fullText": "인식된 전체 텍스트 (줄바꿈 포함)",
  "segments": [
    {
      "text": "인식된 텍스트 조각 (어절 또는 구 단위)",
      "confidence": 0.95
    }
  ],
  "overallConfidence": 0.85,
  "lowConfidenceWords": [
    {
      "original": "AI가 인식한 글자",
      "candidates": ["대체 후보1", "대체 후보2"],
      "confidence": 0.42,
      "reason": "ㅉ과 ㅆ이 유사하게 보임"
    }
  ]
}`;
}


// ============================================================
// 2. 글쓰기 분석 프롬프트 — 핵심 피드백 생성
// ============================================================

// 활동형 글쓰기 유형 설명 — AI가 글의 의도와 형식을 이해하도록 보조.
// (과제 폼의 글 종류 목록과 키를 맞춤. 일반 유형은 이름만으로 충분해 생략.)
const WRITING_TYPE_GUIDES: Record<string, string> = {
  "생각 일지": "주제나 경험에 대한 자신의 생각·느낌을 솔직하게 풀어 쓰는 글입니다. 정해진 정답보다 생각의 깊이와 근거, 솔직한 표현을 중시하세요.",
  "PMI 쓰기": "하나의 주제에 대해 장점(Plus), 단점(Minus), 흥미로운 점(Interesting)을 나누어 쓰는 활동입니다. 세 관점이 고루 다뤄졌는지, 각 항목이 주제와 맞고 구체적인지를 살펴보세요.",
};

export function buildAnalysisPrompt(params: {
  studentName: string;
  assignmentTitle: string;
  roundNumber: number;
  writingType: string;       // "일기", "독후감", "소감문" 등
  assignmentDescription: string | null; // 과제 안내 / 주제 설명
  text: string;              // 학생이 쓴 글
  charCount: number;
  minChars: number | null;
  rubricAreas: RubricArea[];
  totalScore: number;
  scoringGuide: ScoringGuide | null;
  previousScores: PreviousScore | null;
  previousRound: number | null;
  aiPromptNote: string | null; // 교사 커스텀 지시
}): string {
  const {
    studentName,
    assignmentTitle,
    roundNumber,
    writingType,
    assignmentDescription,
    text,
    charCount,
    minChars,
    rubricAreas,
    totalScore,
    scoringGuide,
    previousScores,
    previousRound,
    aiPromptNote,
  } = params;

  // ── 글 유형 설명 (활동형 글쓰기는 AI가 의도를 알도록 안내) ──
  const writingTypeNote = WRITING_TYPE_GUIDES[writingType]
    ? `\n  · ${writingType}: ${WRITING_TYPE_GUIDES[writingType]}`
    : "";

  // ── 글의 주제 / 과제 안내 (주제 관련성 평가 근거) ──
  const topicSection =
    assignmentDescription && assignmentDescription.trim()
      ? `
## 글의 주제 · 과제 안내
"""
${assignmentDescription.trim()}
"""
→ 학생의 글이 이 주제·안내에 얼마나 부합하는지(주제 관련성)를 평가하세요.`
      : `
## 글의 주제
별도로 지정된 주제가 없습니다. 글 유형(${writingType})과 제목("${assignmentTitle}")에 비추어 글의 초점이 일관되고 글 유형에 맞는지를 주제 관련성으로 평가하세요.`;

  // ── 루브릭 영역 동적 생성 ──
  const rubricSection = rubricAreas
    .map((area) => {
      let line = `- ${area.key}: ${area.name} (0~${area.maxScore}점) — ${area.description}`;
      if (scoringGuide?.[area.key]) {
        const guide = scoringGuide[area.key];
        line += `\n    · 상: ${guide.high}`;
        line += `\n    · 중: ${guide.mid}`;
        line += `\n    · 하: ${guide.low}`;
      }
      return line;
    })
    .join("\n");

  // ── 이전 점수 비교 컨텍스트 ──
  let previousContext = "";
  if (previousScores && previousRound) {
    const prevEntries = rubricAreas
      .map((area) => `${area.name} ${previousScores[area.key] ?? "?"}점`)
      .join(", ");
    const prevTotal = Object.values(previousScores).reduce((a, b) => a + b, 0);
    previousContext = `
## 이전 회차 (${previousRound}회차) 점수
${prevEntries}, 총점 ${prevTotal}점
→ 이전과 비교하여 어떤 영역이 성장했고, 어떤 영역이 정체인지 분석해주세요.`;
  } else {
    previousContext = `
## 이전 기록
첫 회차입니다. 비교 분석은 생략하세요.`;
  }

  // ── 교사 커스텀 지시 ──
  const customNote = aiPromptNote
    ? `\n## 교사 요청사항\n${aiPromptNote}`
    : "";

  // ── 분량 참고 ──
  const charInfo = minChars
    ? `글자 수: ${charCount}자 (최소 기준: ${minChars}자)`
    : `글자 수: ${charCount}자`;

  // ── scores JSON 키 동적 생성 ──
  const scoresExample = rubricAreas
    .map((area) => `    "${area.key}": 점수`)
    .join(",\n");

  // ── areaAnalysis JSON 키 동적 생성 ──
  const areaAnalysisExample = rubricAreas
    .map(
      (area) => `    "${area.key}": {
      "score": 점수,
      "comment": "${area.name} 영역에 대한 구체적 분석 (2~3문장)"
    }`
    )
    .join(",\n");

  return `당신은 대한민국 초등학교 4학년 글쓰기를 분석하는 전문 교사입니다.

## 분석 대상

- 학생: ${studentName}
- 과제: ${assignmentTitle} (${roundNumber}회차)
- 글 유형: ${writingType}${writingTypeNote}
- ${charInfo}
${topicSection}
${previousContext}
${customNote}

## 학생이 쓴 글

"""
${text}
"""

## 평가 기준 (${totalScore}점 만점)

${rubricSection}

## 생성할 내용

두 가지를 생성해주세요:

### A. 교사용 상세 분석
- 각 영역별 점수와 근거
- 글의 주제(과제 안내)와의 관련성: 주제에 잘 맞는지, 벗어나거나 빠진 부분은 없는지 (실제 내용을 근거로)
- 구체적인 오류/개선점 (실제 문장을 인용하여)
- 이전 회차 대비 변화 분석 (있는 경우)
- 다음 지도 방향 제안

### B. 학생용 피드백
- 반말 존댓말(~해요, ~했어요)로, 따뜻하고 구체적으로
- 잘한 점을 먼저 충분히 칭찬 (학생의 실제 문장을 인용)
- 개선할 점은 1~2개만, "이렇게 바꿔보면 어떨까요?" 식으로
- 글이 주제에서 벗어난 부분이 있으면, 제안에 부드럽게 포함해 주세요
- 절대 혼내는 톤이 아님, 성장을 격려하는 톤

## 채점 원칙

- 초등 4학년 수준을 기준으로 채점하세요. 성인 기준이 아닙니다.
- 같은 학생의 이전 글이 있으면, 그 학생의 성장 맥락에서 채점하세요.
- 극단적 점수(0~3, 19~20)는 명확한 근거가 있을 때만 부여하세요.
- 각 영역 점수의 합이 반드시 총점이 되어야 합니다.

## 응답 형식

반드시 아래 JSON만 출력하세요. 다른 텍스트나 마크다운 없이 JSON만 응답합니다.

{
  "scores": {
${scoresExample}
  },
  "totalScore": 합산총점,

  "feedbackTeacher": {
    "areaAnalysis": {
${areaAnalysisExample}
    },
    "topicRelevance": {
      "rating": "높음 | 보통 | 낮음 중 하나",
      "comment": "글의 주제(과제 안내)와의 관련성 평가 (1~2문장, 글의 내용을 근거로)"
    },
    "grammarErrors": [
      {
        "original": "학생이 쓴 표현",
        "corrected": "올바른 표현",
        "type": "맞춤법 | 띄어쓰기 | 문법 | 어휘",
        "explanation": "간단한 설명"
      }
    ],
    "repetitions": [
      {
        "word": "반복 사용된 표현",
        "count": 횟수,
        "alternatives": ["대체 표현1", "대체 표현2"]
      }
    ],
    "overall": "종합 분석 (2~3문장, 객관적 톤)",
    "comparisonWithPrevious": "이전 회차 대비 변화 분석 (없으면 null)",
    "teachingDirection": "이 학생에게 다음에 지도할 방향 제안 (1~2문장)"
  },

  "feedbackStudent": {
    "praise": "${studentName} 학생에게 보내는 칭찬 (3~4문장, 실제 문장 인용하며 구체적으로)",
    "suggestion": "개선할 점 1~2개를 따뜻하게 제안 (2~3문장, 예시 문장 포함)",
    "encouragement": "격려와 응원 한마디 (1~2문장)"
  }
}`;
}


// ============================================================
// 2-1. 글 다듬기(수정해 주기) 프롬프트
// 교사가 "수정해 주기(AI)"를 누르면, 피드백(맞춤법·문법 오류, 제안)에
// 근거해 학생 글을 다듬은 버전을 만든다. 학생이 원본과 비교할 모범 예시.
// ============================================================

export function buildCorrectionPrompt(params: {
  writingType: string;
  originalText: string;
  grammarErrors: { original: string; corrected: string; type: string }[];
  repetitions: { word: string; alternatives: string[] }[];
  suggestion: string | null; // 학생용 피드백의 개선 제안
}): string {
  const { writingType, originalText, grammarErrors, repetitions, suggestion } = params;

  const grammarSection =
    grammarErrors.length > 0
      ? grammarErrors
          .map((g) => `- "${g.original}" → "${g.corrected}" (${g.type})`)
          .join("\n")
      : "- (지적된 맞춤법·문법 오류 없음)";

  const repetitionSection =
    repetitions.length > 0
      ? repetitions
          .map(
            (r) =>
              `- "${r.word}"이(가) 반복됨${
                r.alternatives.length > 0 ? ` → ${r.alternatives.join(", ")} 등으로 다양화` : ""
              }`
          )
          .join("\n")
      : "- (지적된 반복 표현 없음)";

  return `당신은 대한민국 초등학교 4학년 글쓰기를 지도하는 따뜻한 교사입니다.
한 학생이 쓴 ${writingType}을(를), 아래 피드백에 근거해 **자연스럽게 다듬어** 주세요.
이 다듬은 글은 학생이 자기 원본과 나란히 보며 "이렇게 고치면 좋구나"를 배우는 모범 예시입니다.

## 다듬기 원칙 (매우 중요)
- **학생의 생각·경험·내용·순서를 그대로 유지**하세요. 새로운 사건·감정·정보를 지어내지 마세요.
- 맞춤법, 띄어쓰기, 문법 오류를 바로잡으세요.
- 어색하거나 반복되는 표현을 자연스럽게 고치되, **초등학교 4학년이 쓸 법한 쉬운 말**을 유지하세요. 어른스러운 문장으로 바꾸지 마세요.
- 글의 분량은 원본과 비슷하게 유지하세요. 크게 늘리거나 줄이지 마세요.
- 학생의 말투와 개성은 살려 주세요. 완전히 다른 글로 바꾸는 게 아닙니다.

## 지적된 맞춤법·문법 오류
${grammarSection}

## 지적된 반복 표현
${repetitionSection}

## 개선 제안 (학생용 피드백)
${suggestion ? suggestion : "- (별도 제안 없음)"}

## 학생이 쓴 원본 글
"""
${originalText}
"""

## 응답 형식
반드시 아래 JSON만 출력하세요. 다른 텍스트나 마크다운 없이 JSON만 응답합니다.

{
  "correctedText": "다듬은 글 전체 (문단 구분은 \\n 사용)"
}`;
}


// ============================================================
// 3. 학년말 종합 보고서 프롬프트
// ============================================================

export function buildYearendReportPrompt(params: {
  studentName: string;
  className: string;
  year: number;
  rubricAreas: RubricArea[];
  totalScore: number;
  writings: WritingHistory[];
}): string {
  const {
    studentName,
    className,
    year,
    rubricAreas,
    totalScore,
    writings,
  } = params;

  const first = writings[0];
  const last = writings[writings.length - 1];
  const growth = last.totalScore - first.totalScore;

  // ── 영역별 시작/끝 점수 ──
  const areaGrowthSummary = rubricAreas
    .map((area) => {
      const startScore = first.scores[area.key] ?? 0;
      const endScore = last.scores[area.key] ?? 0;
      const diff = endScore - startScore;
      const sign = diff >= 0 ? "+" : "";
      return `- ${area.name}: ${startScore}점 → ${endScore}점 (${sign}${diff})`;
    })
    .join("\n");

  // ── 전체 글 목록 요약 ──
  const writingList = writings
    .map(
      (w) =>
        `  ${w.roundNumber}회차 | ${w.date} | ${w.title || "(제목 없음)"} | 총점 ${w.totalScore}/${totalScore} | ${w.textPreview.slice(0, 80)}...`
    )
    .join("\n");

  // ── areaGrowth JSON 키 동적 생성 ──
  const areaGrowthExample = rubricAreas
    .map(
      (area) => `      "${area.key}": {
        "name": "${area.name}",
        "startScore": 시작점수,
        "endScore": 최종점수,
        "comment": "${area.name} 영역의 1년 변화 분석 (2~3문장)"
      }`
    )
    .join(",\n");

  return `당신은 대한민국 초등학교 4학년 담임교사입니다.
학생 "${studentName}" (${className})의 ${year}년도 1년간 글쓰기 성장을 종합 분석해주세요.

## 데이터 요약

- 총 분석 횟수: ${writings.length}회
- 시작 총점: ${first.totalScore}점 → 최종 총점: ${last.totalScore}점 (${growth >= 0 ? "+" : ""}${growth}점)

### 영역별 변화
${areaGrowthSummary}

### 전체 글 목록
${writingList}

## 생성할 내용

두 가지 보고서를 생성해주세요:

### A. 교사/학부모용 보고서
- 격식체 (합니다 체)
- 1년간의 변화를 객관적으로 분석
- 가장 성장한 영역과 아직 부족한 영역을 균형 있게
- 특별히 빛났던 글이 있다면 언급
- 다음 학년 학습 제안

### B. 학생용 성장 스토리
- 따뜻한 반말 (~했어, ~었어)
- 1년 전과 지금을 비교하며 성장을 실감하게
- 가장 빛났던 순간을 구체적으로 칭찬
- 다음 학년 미션을 재미있게 제시
- 선생님의 진심 어린 마무리 메시지

## 응답 형식

반드시 아래 JSON만 출력하세요. 다른 텍스트나 마크다운 없이 JSON만 응답합니다.

{
  "reportTeacher": {
    "summary": "종합 분석 (3~4문단, 교사/학부모 대상 격식체)",
    "areaGrowth": {
${areaGrowthExample}
    },
    "milestones": [
      {
        "roundNumber": 회차번호,
        "title": "글 제목",
        "description": "이 글이 의미 있는 이유 (1문장)"
      }
    ],
    "bestSentences": [
      {
        "roundNumber": 회차번호,
        "sentence": "학생이 쓴 빛나는 문장"
      }
    ],
    "nextYearSuggestions": [
      "다음 학년 학습 제안 1",
      "다음 학년 학습 제안 2",
      "다음 학년 학습 제안 3"
    ]
  },

  "reportStudent": {
    "growthStory": "${studentName}에게 보내는 1년 성장 이야기 (4~5문장, 따뜻한 반말)",
    "bestMoments": "가장 빛났던 순간들 (2~3문장, 구체적 글 언급)",
    "improvements": [
      {
        "area": "영역 이름",
        "before": "처음에는 이랬는데",
        "after": "지금은 이렇게 달라졌어!"
      }
    ],
    "nextYearMission": [
      "다음 학년 미션 1 (재미있게)",
      "다음 학년 미션 2",
      "다음 학년 미션 3"
    ],
    "teacherMessage": "선생님의 1년 마무리 메시지 (3~4문장, 감동적으로)"
  }
}`;
}


// ============================================================
// 3-2. 행동특성 및 종합의견 초안 프롬프트 (학기말 글쓰기 기반)
// ============================================================

const BEHAVIOR_LENGTH_GUIDE: Record<string, string> = {
  brief: "200자 내외로 간결하게",
  standard: "350자 내외로",
  detailed: "500자 내외로 풍부하게",
};

export function buildBehaviorReportPrompt(params: {
  studentName: string;
  className: string;
  year: number;
  qa: { question: string; answer: string }[];
  length: "brief" | "standard" | "detailed";
  teacherNote: string | null;
}): string {
  const { studentName, className, year, qa, length, teacherNote } = params;

  // 답변이 있는 질문만 포함
  const qaSection = qa
    .filter((x) => x.answer.trim().length > 0)
    .map((x, i) => `${i + 1}. (질문) ${x.question}\n   (학생 답변) ${x.answer.trim()}`)
    .join("\n\n");

  const lengthGuide = BEHAVIOR_LENGTH_GUIDE[length] ?? BEHAVIOR_LENGTH_GUIDE.standard;
  const customNote = teacherNote ? `\n## 교사 요청사항\n${teacherNote}` : "";

  return `당신은 대한민국 초등학교 담임교사로서, 학교생활기록부의 "행동특성 및 종합의견"을 작성하는 전문가입니다.
아래는 학생 "${studentName}" (${className}, ${year}년)이 학기말에 자기 자신을 돌아보며 쓴 질문별 답변입니다.
이 자료를 근거로 "행동특성 및 종합의견" 초안을 작성해주세요.

## 학생의 학기말 글쓰기 답변

${qaSection}
${customNote}

## 작성 지침

- 생활기록부 문체를 따르세요: 격식체·개조식 명사형 종결("~함", "~임", "~을 보임", "~하는 모습이 관찰됨").
- **관찰 가능한 행동·태도·성품** 중심으로 서술하세요. 막연한 칭찬이 아니라 구체적 근거(학생 답변에 드러난 사례)를 녹여주세요.
- 긍정적이고 발전 가능성을 보여주는 방향으로 쓰되, 사실에 근거하지 않은 과장이나 단정은 피하세요.
- 학업 성취 등수·점수, 가정환경·종교·신체 등 민감하거나 차별적 표현은 절대 쓰지 마세요.
- 분량은 ${lengthGuide} 한 단락으로 작성하세요.
- 이것은 교사가 검토·수정할 **초안**입니다. 자연스럽게 바로 붙여넣어 다듬을 수 있게 작성하세요.

## 응답 형식

반드시 아래 JSON만 출력하세요. 다른 텍스트나 마크다운 없이 JSON만 응답합니다.

{
  "draft": "행동특성 및 종합의견 초안 (한 단락, 생활기록부 문체)",
  "keywords": ["핵심 특성 키워드 (예: 성실, 배려, 리더십)", "..."]
}`;
}


// ============================================================
// 4. 기본 루브릭 템플릿 (시스템 초기값)
// ============================================================

export const DEFAULT_RUBRIC_AREAS: RubricArea[] = [
  {
    key: "content",
    name: "내용",
    maxScore: 20,
    description: "주제에 맞는 내용을 풍부하게 썼는가",
  },
  {
    key: "structure",
    name: "구성",
    maxScore: 20,
    description: "글의 흐름이 자연스럽고, 문단이 구분되어 있는가",
  },
  {
    key: "expression",
    name: "표현",
    maxScore: 20,
    description: "다양한 어휘와 비유, 생생한 묘사를 사용했는가",
  },
  {
    key: "grammar",
    name: "맞춤법·문법",
    maxScore: 20,
    description: "맞춤법, 띄어쓰기, 문법이 정확한가",
  },
  {
    key: "volume",
    name: "분량",
    maxScore: 20,
    description: "최소 글자 수를 충족하고, 내용에 비해 적절한 양인가",
  },
];

// ── 학기말 글쓰기(행동특성 자료 수집) 기본 질문 세트 ──
// 교사가 새 과제 폼에서 초기값으로 사용하며 자유롭게 편집할 수 있습니다.
// 각 질문은 생활기록부 "행동특성 및 종합의견"의 관찰 영역과 대응됩니다.
export interface BehaviorQuestion {
  id: string;
  text: string;
}

export const DEFAULT_BEHAVIOR_QUESTIONS: BehaviorQuestion[] = [
  { id: "q1", text: "이번 학기에 가장 열심히 노력한 일은 무엇인가요? 그 과정을 자세히 써보세요." },
  { id: "q2", text: "공부하거나 활동할 때 나는 어떤 태도로 참여했나요? (집중, 끈기, 준비 등)" },
  { id: "q3", text: "친구들과 어떻게 지냈나요? 도움을 주거나 받았던 일이 있다면 써보세요." },
  { id: "q4", text: "우리 반이나 친구를 위해 내가 한 일(배려, 양보, 봉사 등)이 있나요?" },
  { id: "q5", text: "맡은 역할이나 책임(1인 1역, 모둠 활동 등)을 어떻게 해냈나요?" },
  { id: "q6", text: "이번 학기에 가장 크게 성장하거나 달라진 점은 무엇인가요?" },
  { id: "q7", text: "내가 좋아하거나 관심 있는 것, 잘하는 것은 무엇인가요?" },
  { id: "q8", text: "다음 학기에 더 노력하고 싶은 점이 있다면 무엇인가요?" },
];

export const DEFAULT_SCORING_GUIDE: ScoringGuide = {
  content: {
    high: "18~20: 주제를 깊이 있게 다루고, 자신의 경험·생각·느낌이 구체적으로 드러남",
    mid: "13~17: 주제에 맞는 내용이나, 구체적 사례나 깊이가 부족함",
    low: "~12: 주제와 관련 없는 내용이 많거나, 내용이 매우 빈약함",
  },
  structure: {
    high: "18~20: 처음-중간-끝이 뚜렷하고, 문장 간 연결이 자연스러움",
    mid: "13~17: 흐름은 있으나 문단 구분이 없거나, 연결이 어색한 부분이 있음",
    low: "~12: 나열식으로 시간순 사건만 나열, 글의 구조가 없음",
  },
  expression: {
    high: "18~20: 비유, 의성어/의태어, 감각적 묘사가 2회 이상, 다양한 어휘 사용",
    mid: "13~17: 표현 시도는 있으나 단조로움. '재미있었다', '좋았다' 등 반복",
    low: "~12: 거의 모든 문장이 '~했다'로 끝남, 반복 표현만 사용",
  },
  grammar: {
    high: "18~20: 맞춤법·띄어쓰기 오류 0~1개",
    mid: "13~17: 오류 2~5개, 대체로 읽는 데 지장 없음",
    low: "~12: 오류 6개 이상, 읽기에 불편을 줌",
  },
  volume: {
    high: "18~20: 최소 기준의 150% 이상, 내용에 비해 충분한 양",
    mid: "13~17: 최소 기준 충족~130%, 조금 더 쓸 수 있었음",
    low: "~12: 최소 기준 미달, 또는 의미 없는 반복으로 양만 채움",
  },
};


// ============================================================
// 5. 프롬프트 사용 예시 (실제 호출 흐름)
// ============================================================

/*
// --- OCR 호출 ---
const ocrPrompt = buildOcrPrompt();
// Gemini: model.generateContent([ocrPrompt, { inlineData: { mimeType, data } }])
// Claude: client.messages.create({ messages: [{ role: "user", content: [image, text] }] })

// --- 분석 호출 ---
const analysisPrompt = buildAnalysisPrompt({
  studentName: "김도윤",
  assignmentTitle: "주간 일기",
  roundNumber: 12,
  writingType: "일기",
  text: "오늘 우리 반은 전주한옥마을에 현장체험학습을 갔다...",
  charCount: 287,
  minChars: 100,
  rubricAreas: DEFAULT_RUBRIC_AREAS,
  totalScore: 100,
  scoringGuide: DEFAULT_SCORING_GUIDE,
  previousScores: { content: 13, structure: 12, expression: 11, grammar: 16, volume: 16 },
  previousRound: 11,
  aiPromptNote: null,
});

// --- 학년말 보고서 호출 ---
const yearendPrompt = buildYearendReportPrompt({
  studentName: "김도윤",
  className: "4학년 2반",
  year: 2026,
  rubricAreas: DEFAULT_RUBRIC_AREAS,
  totalScore: 100,
  writings: [ ... ], // DB에서 조회한 전체 글 목록
});
*/
