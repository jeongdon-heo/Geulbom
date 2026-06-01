import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { getAI, getApiKeyFromHeaders, getProvider } from "@/lib/ai";
import { buildBehaviorReportPrompt } from "@/lib/prompts";
import { behaviorReportResponseSchema } from "@/lib/ai-schemas";
import { behaviorReportPostSchema } from "@/lib/validations";

// ============================================================
// POST /api/reports/behavior
//
// 학기말 글쓰기 답변을 근거로 "행동특성 및 종합의견" 초안 생성/재생성 (교사 전용)
//   Body: { studentId, assignmentId, length, provider? }
//   Headers: x-gemini-api-key / x-anthropic-api-key (선택)
// ============================================================

interface AnswerItem {
  questionId: string;
  question: string;
  answer: string;
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

  const parsed = behaviorReportPostSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");
  const { studentId, assignmentId, length } = parsed.data;

  // 학생 + 학급 소유권
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: { select: { id: true, name: true, year: true, teacherId: true } } },
  });
  if (!student) return fail("학생을 찾을 수 없습니다.", 404);
  if (student.class.teacherId !== auth.teacherId)
    return fail("권한이 없습니다.", 403);

  // 학기말 글쓰기 과제 소유권 + 유형 확인
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, type: true, classId: true, aiPromptNote: true },
  });
  if (!assignment) return fail("과제를 찾을 수 없습니다.", 404);
  if (assignment.classId !== student.class.id)
    return fail("학생과 과제의 학급이 일치하지 않습니다.", 400);
  if (assignment.type !== "SEMESTER_END")
    return fail("학기말 글쓰기 과제만 행동특성 초안을 만들 수 있습니다.", 400);

  // 학생의 제출(SUBMITTED) 조회
  const submission = await prisma.submission.findFirst({
    where: {
      studentId,
      status: "SUBMITTED",
      assignmentRound: { assignmentId },
    },
    select: { text: true, answers: true },
  });
  if (!submission)
    return fail("이 학생이 아직 학기말 글쓰기를 제출하지 않았습니다.", 422);

  // qa 구성 (구조화된 answers 우선, 없으면 text 통째로)
  const qa: { question: string; answer: string }[] = Array.isArray(submission.answers)
    ? (submission.answers as unknown as AnswerItem[]).map((a) => ({
        question: a.question,
        answer: a.answer,
      }))
    : [{ question: "학기말 글쓰기", answer: submission.text }];

  if (!qa.some((x) => x.answer.trim().length > 0))
    return fail("제출된 답변 내용이 비어 있습니다.", 422);

  // AI 호출
  const provider =
    parsed.data.provider ?? getProvider(req.headers.get("x-ai-provider"));
  const apiKey = getApiKeyFromHeaders(req.headers, provider);

  const prompt = buildBehaviorReportPrompt({
    studentName: student.name,
    className: student.class.name,
    year: student.class.year,
    qa,
    length,
    teacherNote: assignment.aiPromptNote,
  });

  let raw: unknown;
  try {
    const ai = getAI(provider, apiKey);
    raw = await ai.generateJSON(prompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 호출 실패";
    return fail(`AI 초안 생성 실패: ${msg}`, 502);
  }

  const validated = behaviorReportResponseSchema.safeParse(raw);
  if (!validated.success) {
    return fail(
      `AI 응답이 예상 형식과 다릅니다: ${validated.error.issues[0]?.message ?? ""}`,
      502
    );
  }
  const content = validated.data;

  const saved = await prisma.behaviorReport.upsert({
    where: { studentId_assignmentId: { studentId, assignmentId } },
    create: {
      studentId,
      assignmentId,
      content: content as unknown as Prisma.InputJsonValue,
      length,
      aiProvider: provider,
    },
    update: {
      content: content as unknown as Prisma.InputJsonValue,
      length,
      aiProvider: provider,
      generatedAt: new Date(),
    },
    select: { id: true, generatedAt: true },
  });

  return ok({
    id: saved.id,
    generatedAt: saved.generatedAt,
    aiProvider: provider,
    length,
    content,
  });
}
