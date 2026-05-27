import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { updateFeedbackSchema } from "@/lib/validations";

// ============================================================
// /api/feedback/[id]   (교사 전용)
// GET     상세 조회 (원문 포함)
// PATCH   교사 코멘트/학생용 수정/승인
// ============================================================

async function loadOwned(id: string, teacherId: string) {
  const fb = await prisma.feedback.findUnique({
    where: { id },
    include: {
      submission: {
        include: {
          assignmentRound: {
            include: {
              assignment: {
                include: {
                  class: { select: { id: true, teacherId: true, name: true } },
                  rubricTemplate: true,
                },
              },
            },
          },
          student: { select: { id: true, name: true, number: true } },
        },
      },
    },
  });
  if (!fb) return { ok: false as const, status: 404, message: "피드백을 찾을 수 없습니다." };
  if (fb.submission.assignmentRound.assignment.class.teacherId !== teacherId)
    return { ok: false as const, status: 403, message: "권한이 없습니다." };
  return { ok: true as const, feedback: fb };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const r = await loadOwned(params.id, auth.teacherId);
  if (!r.ok) return fail(r.message, r.status);

  return ok(r.feedback);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const r = await loadOwned(params.id, auth.teacherId);
  if (!r.ok) return fail(r.message, r.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = updateFeedbackSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const data: Prisma.FeedbackUpdateInput = {};

  if (parsed.data.teacherComment !== undefined)
    data.teacherComment = parsed.data.teacherComment;
  if (parsed.data.teacherEditedStudent !== undefined)
    data.teacherEditedStudent =
      (parsed.data.teacherEditedStudent as Prisma.InputJsonValue | null) ?? Prisma.JsonNull;
  if (parsed.data.approve === true) {
    data.approvalStatus = "APPROVED";
    data.approvedAt = new Date();
  }

  if (Object.keys(data).length === 0) return fail("변경할 항목이 없습니다.");

  const updated = await prisma.feedback.update({
    where: { id: params.id },
    data,
  });

  return ok({
    id: updated.id,
    approvalStatus: updated.approvalStatus,
    approvedAt: updated.approvedAt,
  });
}
