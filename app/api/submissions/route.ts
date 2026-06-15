import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireStudent } from "@/lib/student-session";
import { submissionUpsertSchema } from "@/lib/validations";

// ============================================================
// POST /api/submissions
// 학생이 본인의 제출을 upsert.
//  - action=SAVE_DRAFT: 임시저장 (DRAFT 유지)
//  - action=SUBMIT    : 제출 (SUBMITTED 로 전환, submittedAt 기록)
// 동일 (student, round) 에는 단일 행 (스키마 @@unique)
//
// 선택: ocr 메타데이터를 함께 보내면 OcrRecord upsert.
//   inputMethod=STUDENT_OCR 또는 TEACHER_OCR 일 때 권장.
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await requireStudent();
  if (!auth.ok) return fail(auth.message, auth.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = submissionUpsertSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const { assignmentRoundId, answers, inputMethod, action, ocr } = parsed.data;

  // 학기말 글쓰기는 answers(질문별 답변)를 보냅니다.
  // 서버가 answers로부터 읽기용 text를 조립해 글자수/교사뷰와 호환시킵니다.
  // 일반 과제는 text를 그대로 사용합니다.
  const text =
    answers && answers.length > 0
      ? answers
          .map((a) => `Q. ${a.question}\nA. ${a.answer.trim()}`)
          .join("\n\n")
      : parsed.data.text ?? "";

  // 학생 본인이 보내는 라우트이므로 TEACHER_OCR 는 거부
  if (inputMethod === "TEACHER_OCR") {
    return fail("학생 화면에서는 TEACHER_OCR 로 저장할 수 없어요.");
  }

  // 회차 + 과제 + 클래스 검증
  const round = await prisma.assignmentRound.findUnique({
    where: { id: assignmentRoundId },
    include: {
      assignment: {
        select: { isActive: true, classId: true, minChars: true },
      },
    },
  });
  if (!round) return fail("회차를 찾을 수 없습니다.", 404);
  if (round.assignment.classId !== auth.session.classId)
    return fail("이 과제에 접근할 수 없습니다.", 403);
  if (!round.assignment.isActive) return fail("비활성화된 과제입니다.", 410);
  if (!round.isOpen) return fail("이 회차는 닫혀 있어요.", 410);

  // 제출 시 최소 글자 수 체크
  // 글자 수는 공백(스페이스·줄바꿈 등)을 제외하고 센다 (클라이언트 표시와 일치)
  const charCount = [...text.replace(/\s/g, "")].length; // 코드 포인트 기준
  if (action === "SUBMIT") {
    if (answers && answers.length > 0) {
      // 학기말 글쓰기: 최소 한 개 질문에는 답해야 제출 가능
      if (!answers.some((a) => a.answer.trim().length > 0))
        return fail("질문에 답을 적어주세요.");
    } else if (text.trim().length === 0) {
      return fail("글을 입력해주세요.");
    }
    if (round.assignment.minChars && charCount < round.assignment.minChars) {
      return fail(
        `최소 ${round.assignment.minChars}자 이상 써야 제출할 수 있어요. (지금 ${charCount}자)`
      );
    }
  }

  // 기존 행 조회
  const existing = await prisma.submission.findUnique({
    where: {
      studentId_assignmentRoundId: {
        studentId: auth.session.studentId,
        assignmentRoundId,
      },
    },
    select: { id: true, status: true },
  });

  // 이미 제출된 건 다시 수정/재제출 불가 (단순화)
  if (existing?.status === "SUBMITTED") {
    return fail("이미 제출한 글은 수정할 수 없어요.", 409);
  }

  const data = {
    text,
    charCount,
    answers:
      answers && answers.length > 0
        ? (answers as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    inputMethod,
    status: action === "SUBMIT" ? ("SUBMITTED" as const) : ("DRAFT" as const),
    submittedAt: action === "SUBMIT" ? new Date() : null,
  };

  const saved = existing
    ? await prisma.submission.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.submission.create({
        data: {
          studentId: auth.session.studentId,
          assignmentRoundId,
          ...data,
        },
      });

  // OCR 메타데이터 저장 (있을 때만)
  if (ocr) {
    const segmentsJson = ocr.segments as unknown as Prisma.InputJsonValue;
    const correctionsJson = ocr.corrections as unknown as Prisma.InputJsonValue;
    await prisma.ocrRecord.upsert({
      where: { submissionId: saved.id },
      create: {
        submissionId: saved.id,
        imageUrl: ocr.imageUrl,
        ocrRawText: ocr.ocrRawText,
        editedText: text,
        confidence: ocr.confidence,
        aiProvider: ocr.aiProvider,
        segments: segmentsJson,
        corrections: correctionsJson,
      },
      update: {
        imageUrl: ocr.imageUrl,
        ocrRawText: ocr.ocrRawText,
        editedText: text,
        confidence: ocr.confidence,
        aiProvider: ocr.aiProvider,
        segments: segmentsJson,
        corrections: correctionsJson,
      },
    });
  }

  return ok({
    id: saved.id,
    status: saved.status,
    charCount: saved.charCount,
    submittedAt: saved.submittedAt,
  });
}
