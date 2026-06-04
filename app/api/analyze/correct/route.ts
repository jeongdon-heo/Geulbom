import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { getAI, getApiKeyFromHeaders, getProvider } from "@/lib/ai";
import { buildCorrectionPrompt } from "@/lib/prompts";
import { correctionResponseSchema } from "@/lib/ai-schemas";

// ============================================================
// POST /api/analyze/correct
// Body: { feedbackId, provider?: "gemini"|"claude" }
// Headers: x-gemini-api-key / x-anthropic-api-key (선택)
//
// 동작:
//  교사가 "수정해 주기(AI)"를 누르면, 해당 피드백(맞춤법·문법 오류·제안)에
//  근거해 학생 글을 다듬은 버전을 생성하고 feedback.correctedText에 저장.
//  학생에게는 피드백 승인(APPROVED) 후에만 노출됨.
// ============================================================

const bodySchema = z.object({
  feedbackId: z.string().uuid(),
  provider: z.enum(["gemini", "claude"]).optional(),
});

interface TeacherFb {
  grammarErrors?: { original: string; corrected: string; type: string }[];
  repetitions?: { word: string; alternatives: string[] }[];
}
interface StudentFb {
  suggestion?: string;
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

  // 피드백 + 제출물 조회 + 소유권 확인
  const feedback = await prisma.feedback.findUnique({
    where: { id: parsed.data.feedbackId },
    include: {
      submission: {
        include: {
          assignmentRound: {
            include: {
              assignment: {
                include: { class: { select: { teacherId: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!feedback) return fail("피드백을 찾을 수 없습니다.", 404);
  if (feedback.submission.assignmentRound.assignment.class.teacherId !== auth.teacherId)
    return fail("권한이 없습니다.", 403);

  // 피드백에서 오류·제안 추출 (다듬기 근거)
  const teacherFb = feedback.feedbackTeacher as unknown as TeacherFb;
  // 교사가 학생용 피드백을 수정했다면 그 제안을 우선 사용
  const studentFb = (feedback.teacherEditedStudent ??
    feedback.feedbackStudent) as unknown as StudentFb;

  // AI 호출
  const provider = parsed.data.provider ?? getProvider(req.headers.get("x-ai-provider"));
  const apiKey = getApiKeyFromHeaders(req.headers, provider);

  const prompt = buildCorrectionPrompt({
    writingType: feedback.submission.assignmentRound.assignment.writingType,
    originalText: feedback.submission.text,
    grammarErrors: teacherFb.grammarErrors ?? [],
    repetitions: teacherFb.repetitions ?? [],
    suggestion: studentFb.suggestion ?? null,
  });

  let raw: unknown;
  try {
    const ai = getAI(provider, apiKey);
    raw = await ai.generateJSON(prompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 호출 실패";
    return fail(`AI 다듬기 실패: ${msg}`, 502);
  }

  const validated = correctionResponseSchema.safeParse(raw);
  if (!validated.success) {
    return fail(
      `AI 응답이 예상 형식과 다릅니다: ${validated.error.issues[0]?.message ?? ""}`,
      502
    );
  }

  const correctedText = validated.data.correctedText.trim();

  const saved = await prisma.feedback.update({
    where: { id: feedback.id },
    data: { correctedText },
    select: { id: true, correctedText: true },
  });

  return ok({ id: saved.id, correctedText: saved.correctedText });
}
