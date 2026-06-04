import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireStudent } from "@/lib/student-session";
import { studentRewriteSchema } from "@/lib/validations";

// ============================================================
// PATCH /api/feedback/[id]/rewrite   (학생 전용)
// 학생이 'AI가 다듬은 글'을 참고해 다시 써 본 글을 저장.
//  - 본인 제출물의 피드백만
//  - 승인(APPROVED)된 피드백만 (학생에게 공개된 상태)
//  - 빈 문자열이면 null로 저장(삭제)
// ============================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireStudent();
  if (!auth.ok) return fail(auth.message, auth.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = studentRewriteSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  // 피드백 + 제출물(소유 학생) 조회
  const feedback = await prisma.feedback.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      approvalStatus: true,
      submission: { select: { studentId: true } },
    },
  });
  if (!feedback) return fail("피드백을 찾을 수 없습니다.", 404);
  if (feedback.submission.studentId !== auth.session.studentId)
    return fail("권한이 없습니다.", 403);
  if (feedback.approvalStatus !== "APPROVED")
    return fail("아직 확인할 수 없는 피드백이에요.", 403);

  const text = parsed.data.text.trim();

  const saved = await prisma.feedback.update({
    where: { id: feedback.id },
    data: { studentRewrite: text || null },
    select: { id: true, studentRewrite: true },
  });

  return ok({ id: saved.id, studentRewrite: saved.studentRewrite });
}
