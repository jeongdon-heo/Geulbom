import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { getStudentSession } from "@/lib/student-session";

// ============================================================
// /api/reports/yearend/[id]
//
// GET   : 보고서 단일 조회
//   - 교사: 본인 학급 학생의 보고서만
//   - 학생: 본인 보고서만 (reportTeacher는 제외하고 반환)
// DELETE: 보고서 삭제 (교사 전용, 재생성 전 용도)
// ============================================================

async function loadReport(id: string) {
  return prisma.yearendReport.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, number: true } },
      class: {
        select: { id: true, name: true, year: true, teacherId: true },
      },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const report = await loadReport(params.id);
  if (!report) return fail("보고서를 찾을 수 없습니다.", 404);

  // 교사 우선 시도 → 실패 시 학생 세션
  const teacherAuth = await requireTeacher();
  if (teacherAuth.ok) {
    if (report.class.teacherId !== teacherAuth.teacherId)
      return fail("권한이 없습니다.", 403);
    return ok({
      id: report.id,
      year: report.year,
      generatedAt: report.generatedAt,
      student: report.student,
      class: { id: report.class.id, name: report.class.name },
      reportTeacher: report.reportTeacher,
      reportStudent: report.reportStudent,
    });
  }

  const student = await getStudentSession();
  if (!student) return fail("로그인이 필요합니다.", 401);
  if (report.studentId !== student.studentId)
    return fail("권한이 없습니다.", 403);

  // 학생에게는 reportTeacher 노출하지 않음
  return ok({
    id: report.id,
    year: report.year,
    generatedAt: report.generatedAt,
    student: report.student,
    class: { id: report.class.id, name: report.class.name },
    reportStudent: report.reportStudent,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const report = await loadReport(params.id);
  if (!report) return fail("보고서를 찾을 수 없습니다.", 404);
  if (report.class.teacherId !== auth.teacherId)
    return fail("권한이 없습니다.", 403);

  await prisma.yearendReport.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
