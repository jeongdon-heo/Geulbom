import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { createClassSchema } from "@/lib/validations";
import { generateClassCode } from "@/lib/codes";

// ============================================================
// GET /api/classes    내 학급 목록
// POST /api/classes   학급 생성 (학급코드 자동)
// ============================================================

export async function GET() {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const classes = await prisma.class.findMany({
    where: { teacherId: auth.teacherId },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { students: true, assignments: true } },
    },
  });
  return ok(classes);
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = createClassSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const { name, year } = parsed.data;

  // 학급코드 충돌은 매우 드물지만 보수적으로 재시도
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.class.create({
        data: {
          teacherId: auth.teacherId,
          name,
          year,
          classCode: generateClassCode(),
        },
      });
      return ok(created, { status: 201 });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        // 같은 교사/연도 중복은 재시도해도 의미 없음 → 즉시 반환
        if (target.includes("teacher_id") || target.includes("year")) {
          return fail("같은 연도에 이미 학급이 있습니다.", 409);
        }
        // classCode 충돌이면 재시도
        continue;
      }
      throw e;
    }
  }
  return fail("학급 코드 생성에 실패했습니다. 다시 시도해주세요.", 500);
}
