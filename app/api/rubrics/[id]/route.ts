import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { updateRubricSchema } from "@/lib/validations";
import { sanitizeScoringGuide } from "@/lib/rubric";

// ============================================================
// /api/rubrics/[id]
// 수정/삭제는 본인 소유 루브릭만 가능합니다. (시드/공용 루브릭 보호)
// ============================================================

async function loadOwned(id: string, teacherId: string) {
  const rubric = await prisma.rubricTemplate.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!rubric)
    return { ok: false as const, status: 404, message: "루브릭을 찾을 수 없습니다." };
  if (rubric.teacherId !== teacherId)
    return { ok: false as const, status: 403, message: "본인 루브릭만 수정할 수 있습니다." };
  return { ok: true as const, rubric };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const rubric = await prisma.rubricTemplate.findUnique({
    where: { id: params.id },
    include: {
      teacher: { select: { id: true, name: true, role: true } },
      _count: { select: { assignments: true } },
    },
  });
  if (!rubric) return fail("루브릭을 찾을 수 없습니다.", 404);

  // 본인 루브릭이거나 공용(admin) 루브릭만 열람 허용
  if (rubric.teacherId !== auth.teacherId && rubric.teacher.role !== "admin")
    return fail("권한이 없습니다.", 403);

  return ok(rubric);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const res = await loadOwned(params.id, auth.teacherId);
  if (!res.ok) return fail(res.message, res.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = updateRubricSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const { name, areas } = parsed.data;
  const totalScore = areas.reduce((sum, a) => sum + a.maxScore, 0);
  const scoringGuide = sanitizeScoringGuide(parsed.data.scoringGuide, areas);

  const updated = await prisma.rubricTemplate.update({
    where: { id: params.id },
    data: {
      name,
      totalScore,
      areas,
      scoringGuide: scoringGuide ?? Prisma.DbNull,
    },
  });

  return ok(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const res = await loadOwned(params.id, auth.teacherId);
  if (!res.ok) return fail(res.message, res.status);

  // 과제에서 사용 중이면 삭제 불가 (FK 제약 + 데이터 보호)
  if (res.rubric._count.assignments > 0)
    return fail(
      `이 루브릭을 사용하는 과제가 ${res.rubric._count.assignments}개 있어 삭제할 수 없습니다.`,
      409
    );

  await prisma.rubricTemplate.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
