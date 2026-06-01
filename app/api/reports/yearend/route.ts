import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { getAI, getApiKeyFromHeaders, getProvider } from "@/lib/ai";
import { buildYearendReportPrompt } from "@/lib/prompts";
import { yearendReportResponseSchema } from "@/lib/ai-schemas";

// ============================================================
// /api/reports/yearend
//
// POST: 학생의 학년말 종합 보고서 생성/재생성 (교사 전용)
//   Body: { studentId, provider?: "gemini"|"claude" }
//   Headers: x-gemini-api-key / x-anthropic-api-key (선택)
//
// GET : 학급의 보고서 생성 상태 조회 (교사 전용)
//   Query: classId
//   → 학생 목록 + 각 학생의 보고서 존재 여부 + 분석된 글 수
// ============================================================

interface RubricArea {
  key: string;
  name: string;
  maxScore: number;
  description: string;
}

const postSchema = z.object({
  studentId: z.string().uuid(),
  provider: z.enum(["gemini", "claude"]).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  // 학생 + 학급 + 소유권 확인
  const student = await prisma.student.findUnique({
    where: { id: parsed.data.studentId },
    include: {
      class: {
        select: { id: true, name: true, year: true, teacherId: true },
      },
    },
  });
  if (!student) return fail("학생을 찾을 수 없습니다.", 404);
  if (student.class.teacherId !== auth.teacherId)
    return fail("권한이 없습니다.", 403);

  // 학생의 APPROVED 피드백 + 회차 + 글 텍스트 + 루브릭 일괄 조회
  const submissions = await prisma.submission.findMany({
    where: {
      studentId: student.id,
      status: "SUBMITTED",
      feedback: { approvalStatus: "APPROVED" },
    },
    orderBy: [
      { assignmentRound: { assignment: { createdAt: "asc" } } },
      { assignmentRound: { roundNumber: "asc" } },
    ],
    select: {
      id: true,
      text: true,
      submittedAt: true,
      assignmentRound: {
        select: {
          roundNumber: true,
          deadline: true,
          title: true,
          assignment: {
            select: {
              title: true,
              rubricTemplate: {
                select: { id: true, totalScore: true, areas: true },
              },
            },
          },
        },
      },
      feedback: {
        select: {
          totalScore: true,
          scores: true,
          approvedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (submissions.length < 2)
    return fail("학년말 보고서를 만들려면 승인된 글이 최소 2편 필요합니다.", 422);

  // 가장 최근 루브릭을 기준으로 영역 정보 사용
  const latest = submissions[submissions.length - 1];
  const rubricAreas =
    (latest.assignmentRound.assignment.rubricTemplate?.areas as unknown as RubricArea[]) ??
    [];
  const totalScoreMax =
    latest.assignmentRound.assignment.rubricTemplate?.totalScore ?? 100;

  if (rubricAreas.length === 0)
    return fail("루브릭 영역 정보가 없습니다.", 422);

  // 프롬프트용 writings 구성
  const writings = submissions.map((s) => ({
    roundNumber: s.assignmentRound.roundNumber,
    title:
      s.assignmentRound.title ?? s.assignmentRound.assignment.title ?? null,
    date: (s.submittedAt ?? s.assignmentRound.deadline).toISOString().slice(0, 10),
    scores: s.feedback!.scores as unknown as Record<string, number>,
    totalScore: s.feedback!.totalScore,
    textPreview: s.text.slice(0, 200),
  }));

  // AI 호출
  const provider =
    parsed.data.provider ?? getProvider(req.headers.get("x-ai-provider"));
  const apiKey = getApiKeyFromHeaders(req.headers, provider);

  const prompt = buildYearendReportPrompt({
    studentName: student.name,
    className: student.class.name,
    year: student.class.year,
    rubricAreas,
    totalScore: totalScoreMax,
    writings,
  });

  let raw: unknown;
  try {
    const ai = getAI(provider, apiKey);
    raw = await ai.generateJSON(prompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 호출 실패";
    return fail(`AI 보고서 생성 실패: ${msg}`, 502);
  }

  const validated = yearendReportResponseSchema.safeParse(raw);
  if (!validated.success) {
    return fail(
      `AI 응답이 예상 형식과 다릅니다: ${validated.error.issues[0]?.message ?? ""}`,
      502
    );
  }
  const v = validated.data;

  // upsert (학생×연도 유니크)
  const saved = await prisma.yearendReport.upsert({
    where: {
      studentId_year: { studentId: student.id, year: student.class.year },
    },
    create: {
      studentId: student.id,
      classId: student.class.id,
      year: student.class.year,
      reportTeacher: v.reportTeacher,
      reportStudent: v.reportStudent,
    },
    update: {
      reportTeacher: v.reportTeacher,
      reportStudent: v.reportStudent,
      generatedAt: new Date(),
    },
    select: { id: true, generatedAt: true },
  });

  return ok({
    id: saved.id,
    generatedAt: saved.generatedAt,
    aiProvider: provider,
    submissionCount: submissions.length,
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const classId = req.nextUrl.searchParams.get("classId");
  if (!classId) return fail("classId 쿼리 파라미터가 필요합니다.");

  // 소유권 확인
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, year: true, teacherId: true },
  });
  if (!klass) return fail("학급을 찾을 수 없습니다.", 404);
  if (klass.teacherId !== auth.teacherId)
    return fail("권한이 없습니다.", 403);

  // 학생 목록 + 보고서 + 승인된 글 수
  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      name: true,
      yearendReports: {
        where: { year: klass.year },
        select: { id: true, generatedAt: true },
      },
      submissions: {
        where: {
          status: "SUBMITTED",
          feedback: { approvalStatus: "APPROVED" },
        },
        select: { id: true },
      },
    },
  });

  const rows = students.map((s) => ({
    id: s.id,
    number: s.number,
    name: s.name,
    approvedCount: s.submissions.length,
    report: s.yearendReports[0]
      ? {
          id: s.yearendReports[0].id,
          generatedAt: s.yearendReports[0].generatedAt,
        }
      : null,
  }));

  return ok({
    classId: klass.id,
    year: klass.year,
    students: rows,
  });
}
