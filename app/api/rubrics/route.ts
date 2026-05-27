import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { createRubricSchema } from "@/lib/validations";
import { sanitizeScoringGuide } from "@/lib/rubric";

// ============================================================
// GET /api/rubrics
// 본인 루브릭 + 시드된 관리자(공용) 루브릭을 함께 반환합니다.
// ============================================================

export async function GET() {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const rubrics = await prisma.rubricTemplate.findMany({
    where: {
      OR: [
        { teacherId: auth.teacherId },
        { teacher: { role: "admin" } }, // 시드 루브릭 공유
      ],
    },
    orderBy: [{ createdAt: "asc" }],
    include: {
      teacher: { select: { id: true, name: true, role: true } },
      _count: { select: { assignments: true } },
    },
  });

  return ok(rubrics);
}

// ============================================================
// POST /api/rubrics
// 새 루브릭 템플릿을 만듭니다. totalScore는 영역 배점 합으로 계산합니다.
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

  const parsed = createRubricSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const { name, areas } = parsed.data;
  const totalScore = areas.reduce((sum, a) => sum + a.maxScore, 0);
  const scoringGuide = sanitizeScoringGuide(parsed.data.scoringGuide, areas);

  const created = await prisma.rubricTemplate.create({
    data: {
      teacherId: auth.teacherId,
      name,
      totalScore,
      areas,
      scoringGuide: scoringGuide ?? undefined,
    },
  });

  return ok(created, { status: 201 });
}
