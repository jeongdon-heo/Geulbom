import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { teacherSubmissionUpsertSchema } from "@/lib/validations";

// ============================================================
// POST /api/submissions/teacher
// 교사가 학생 글을 대신 OCR/타이핑으로 입력해 제출.
//   inputMethod = TEACHER_OCR 로 고정.
//   ocr 메타데이터를 함께 보내면 OcrRecord upsert.
// 이미 학생이 SUBMITTED 한 글은 덮어쓰지 않음 (409).
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = teacherSubmissionUpsertSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");
  const { assignmentRoundId, studentId, text, action, ocr } = parsed.data;

  const round = await prisma.assignmentRound.findUnique({
    where: { id: assignmentRoundId },
    include: {
      assignment: {
        select: {
          isActive: true,
          classId: true,
          minChars: true,
          class: { select: { teacherId: true } },
        },
      },
    },
  });
  if (!round) return fail("회차를 찾을 수 없습니다.", 404);
  if (round.assignment.class.teacherId !== auth.teacherId)
    return fail("권한이 없습니다.", 403);
  if (!round.assignment.isActive) return fail("비활성화된 과제입니다.", 410);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true },
  });
  if (!student || student.classId !== round.assignment.classId) {
    return fail("학생이 이 학급 소속이 아닙니다.", 400);
  }

  const charCount = [...text].length;
  if (action === "SUBMIT") {
    if (text.trim().length === 0) return fail("글이 비어 있어요.");
    if (round.assignment.minChars && charCount < round.assignment.minChars) {
      return fail(
        `최소 ${round.assignment.minChars}자 이상이어야 합니다. (지금 ${charCount}자)`
      );
    }
  }

  const existing = await prisma.submission.findUnique({
    where: {
      studentId_assignmentRoundId: {
        studentId,
        assignmentRoundId,
      },
    },
    select: { id: true, status: true, inputMethod: true },
  });

  // 학생이 직접 제출한 글을 교사가 덮어쓰는 건 방지
  if (existing?.status === "SUBMITTED" && existing.inputMethod === "TYPED") {
    return fail("학생이 이미 제출한 글이라 교사가 덮어쓸 수 없어요.", 409);
  }

  const data = {
    text,
    charCount,
    inputMethod: "TEACHER_OCR" as const,
    status: action === "SUBMIT" ? ("SUBMITTED" as const) : ("DRAFT" as const),
    submittedAt: action === "SUBMIT" ? new Date() : null,
  };

  const saved = existing
    ? await prisma.submission.update({ where: { id: existing.id }, data })
    : await prisma.submission.create({
        data: {
          studentId,
          assignmentRoundId,
          ...data,
        },
      });

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
