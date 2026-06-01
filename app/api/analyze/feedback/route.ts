import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { getAI, getApiKeyFromHeaders, getProvider } from "@/lib/ai";
import { buildAnalysisPrompt } from "@/lib/prompts";
import { analysisResponseSchema } from "@/lib/ai-schemas";

// ============================================================
// POST /api/analyze/feedback
// Body: { submissionId, provider?: "gemini"|"claude" }
// Headers: x-gemini-api-key / x-anthropic-api-key (선택)
//
// 동작:
//  1) 제출물 + 과제 + 루브릭 + 학생 직전 회차 점수 조회
//  2) 프롬프트 빌드 → AI 호출 → JSON 검증
//  3) Feedback upsert. autoApprove=true 면 즉시 APPROVED.
// ============================================================

const bodySchema = z.object({
  submissionId: z.string().uuid(),
  provider: z.enum(["gemini", "claude"]).optional(),
});

interface RubricArea {
  key: string;
  name: string;
  maxScore: number;
  description: string;
}
interface ScoringGuide {
  [key: string]: { high: string; mid: string; low: string };
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  // 제출물 조회 + 소유권
  const submission = await prisma.submission.findUnique({
    where: { id: parsed.data.submissionId },
    include: {
      student: { select: { id: true, name: true, classId: true } },
      assignmentRound: {
        include: {
          assignment: {
            include: {
              class: { select: { teacherId: true } },
              rubricTemplate: true,
            },
          },
        },
      },
    },
  });
  if (!submission) return fail("제출물을 찾을 수 없습니다.", 404);
  if (submission.assignmentRound.assignment.class.teacherId !== auth.teacherId)
    return fail("권한이 없습니다.", 403);
  if (submission.status !== "SUBMITTED")
    return fail("제출 완료된 글만 분석할 수 있습니다.");

  // 루브릭 areas/scoringGuide — 학기말 글쓰기(루브릭 없음)는 분석 대상이 아님
  const rubric = submission.assignmentRound.assignment.rubricTemplate;
  if (!rubric) return fail("이 과제는 루브릭이 없어 AI 분석 대상이 아닙니다.", 422);
  const rubricAreas = rubric.areas as unknown as RubricArea[];
  const scoringGuide = (rubric.scoringGuide as unknown as ScoringGuide | null) ?? null;

  // 이전 회차 점수 — 같은 (학생, 과제) 의 더 낮은 roundNumber 중 가장 가까운 것
  const prevFeedback = await prisma.feedback.findFirst({
    where: {
      submission: {
        studentId: submission.studentId,
        assignmentRound: {
          assignmentId: submission.assignmentRound.assignmentId,
          roundNumber: { lt: submission.assignmentRound.roundNumber },
        },
      },
    },
    orderBy: { submission: { assignmentRound: { roundNumber: "desc" } } },
    select: {
      scores: true,
      submission: {
        select: {
          assignmentRound: { select: { roundNumber: true } },
        },
      },
    },
  });

  const previousScores = prevFeedback
    ? (prevFeedback.scores as unknown as Record<string, number>)
    : null;
  const previousRound = prevFeedback?.submission.assignmentRound.roundNumber ?? null;

  // AI 호출
  const provider = parsed.data.provider ?? getProvider(req.headers.get("x-ai-provider"));
  const apiKey = getApiKeyFromHeaders(req.headers, provider);

  const prompt = buildAnalysisPrompt({
    studentName: submission.student.name,
    assignmentTitle: submission.assignmentRound.assignment.title,
    roundNumber: submission.assignmentRound.roundNumber,
    writingType: submission.assignmentRound.assignment.writingType,
    text: submission.text,
    charCount: submission.charCount,
    minChars: submission.assignmentRound.assignment.minChars ?? null,
    rubricAreas,
    totalScore: rubric.totalScore,
    scoringGuide,
    previousScores,
    previousRound,
    aiPromptNote: submission.assignmentRound.assignment.aiPromptNote ?? null,
  });

  let raw: unknown;
  try {
    const ai = getAI(provider, apiKey);
    raw = await ai.generateJSON(prompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 호출 실패";
    return fail(`AI 분석 실패: ${msg}`, 502);
  }

  const validated = analysisResponseSchema.safeParse(raw);
  if (!validated.success) {
    return fail(
      `AI 응답이 예상 형식과 다릅니다: ${validated.error.issues[0]?.message ?? ""}`,
      502
    );
  }
  const v = validated.data;

  // 총점 일치 보정 (영역 점수의 합으로 강제 — AI가 어긋날 때 안전)
  const sumOfAreas = Object.values(v.scores).reduce((a, b) => a + b, 0);
  const totalScore =
    Math.abs(sumOfAreas - v.totalScore) > 2 ? sumOfAreas : v.totalScore;

  // autoApprove?
  const autoApprove = submission.assignmentRound.assignment.autoApprove;
  const now = new Date();

  // upsert (재분석 허용)
  const saved = await prisma.feedback.upsert({
    where: { submissionId: submission.id },
    create: {
      submissionId: submission.id,
      aiProvider: provider,
      scores: v.scores,
      totalScore,
      feedbackStudent: v.feedbackStudent,
      feedbackTeacher: v.feedbackTeacher,
      approvalStatus: autoApprove ? "APPROVED" : "PENDING",
      approvedAt: autoApprove ? now : null,
    },
    update: {
      aiProvider: provider,
      scores: v.scores,
      totalScore,
      feedbackStudent: v.feedbackStudent,
      feedbackTeacher: v.feedbackTeacher,
      // 재분석 시 기존 교사 수정/승인 상태는 유지: autoApprove도 새로 만드는 경우에만 적용
    },
  });

  return ok({
    id: saved.id,
    approvalStatus: saved.approvalStatus,
    totalScore: saved.totalScore,
  });
}
