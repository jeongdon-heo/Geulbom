import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";

// ============================================================
// DELETE /api/reports/behavior/[id]
// 행동특성 초안 삭제 (교사 전용, 소유권 확인)
// ============================================================

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const report = await prisma.behaviorReport.findUnique({
    where: { id: params.id },
    select: { id: true, student: { select: { class: { select: { teacherId: true } } } } },
  });
  if (!report) return fail("초안을 찾을 수 없습니다.", 404);
  if (report.student.class.teacherId !== auth.teacherId)
    return fail("권한이 없습니다.", 403);

  await prisma.behaviorReport.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
