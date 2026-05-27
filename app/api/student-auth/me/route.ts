import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getStudentSession } from "@/lib/student-session";

export async function GET() {
  const s = await getStudentSession();
  if (!s) return fail("로그인이 필요합니다.", 401);

  // 학생 정보가 변경됐을 수 있으니 최신 상태로
  const student = await prisma.student.findUnique({
    where: { id: s.studentId },
    select: {
      id: true,
      name: true,
      number: true,
      classId: true,
      class: { select: { name: true, classCode: true } },
    },
  });
  if (!student) return fail("학생을 찾을 수 없습니다.", 404);

  return ok({
    id: student.id,
    name: student.name,
    number: student.number,
    classId: student.classId,
    className: student.class.name,
    classCode: student.class.classCode,
  });
}
