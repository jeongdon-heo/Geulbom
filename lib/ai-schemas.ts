import { z } from "zod";

// ============================================================
// AI 응답 검증 스키마
// 프롬프트가 지정한 JSON 형식이 정확한지 런타임에 확인합니다.
// 키 자체는 루브릭에 따라 동적이므로 record(z.number())로 받습니다.
// ============================================================

// ── OCR 응답 ──
export const ocrResponseSchema = z.object({
  fullText: z.string(),
  segments: z
    .array(
      z.object({
        text: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .default([]),
  overallConfidence: z.number().min(0).max(1),
  lowConfidenceWords: z
    .array(
      z.object({
        original: z.string(),
        candidates: z.array(z.string()).default([]),
        confidence: z.number().min(0).max(1),
        reason: z.string().optional().default(""),
      })
    )
    .default([]),
});
export type OcrResponse = z.infer<typeof ocrResponseSchema>;


export const analysisResponseSchema = z.object({
  scores: z.record(z.string(), z.number().int().min(0).max(100)),
  totalScore: z.number().int().min(0).max(1000),
  feedbackTeacher: z.object({
    areaAnalysis: z.record(
      z.string(),
      z.object({
        score: z.number().int().min(0).max(100),
        comment: z.string(),
      })
    ),
    grammarErrors: z
      .array(
        z.object({
          original: z.string(),
          corrected: z.string(),
          type: z.string(),
          explanation: z.string().optional().default(""),
        })
      )
      .default([]),
    repetitions: z
      .array(
        z.object({
          word: z.string(),
          count: z.number().int().min(0),
          alternatives: z.array(z.string()).default([]),
        })
      )
      .default([]),
    overall: z.string(),
    comparisonWithPrevious: z.string().nullable().optional().default(null),
    teachingDirection: z.string(),
  }),
  feedbackStudent: z.object({
    praise: z.string(),
    suggestion: z.string(),
    encouragement: z.string(),
  }),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;


// ── 학년말 종합 보고서 응답 ──
// 영역 키는 동적이므로 areaGrowth는 record로 받습니다.
export const yearendReportResponseSchema = z.object({
  reportTeacher: z.object({
    summary: z.string(),
    areaGrowth: z.record(
      z.string(),
      z.object({
        name: z.string(),
        startScore: z.number().int().min(0).max(100),
        endScore: z.number().int().min(0).max(100),
        comment: z.string(),
      })
    ),
    milestones: z
      .array(
        z.object({
          roundNumber: z.number().int().min(0),
          title: z.string(),
          description: z.string(),
        })
      )
      .default([]),
    bestSentences: z
      .array(
        z.object({
          roundNumber: z.number().int().min(0),
          sentence: z.string(),
        })
      )
      .default([]),
    nextYearSuggestions: z.array(z.string()).default([]),
  }),
  reportStudent: z.object({
    growthStory: z.string(),
    bestMoments: z.string(),
    improvements: z
      .array(
        z.object({
          area: z.string(),
          before: z.string(),
          after: z.string(),
        })
      )
      .default([]),
    nextYearMission: z.array(z.string()).default([]),
    teacherMessage: z.string(),
  }),
});

export type YearendReportResponse = z.infer<typeof yearendReportResponseSchema>;
