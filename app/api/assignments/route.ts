import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { createAssignmentSchema } from "@/lib/validations";
import { planRounds } from "@/lib/scheduler";

// ============================================================
// GET  /api/assignments?classId=...     해당 학급 과제 목록
// POST /api/assignments                  과제 생성 + 정기면 회차 자동 생성
// ============================================================

export async function GET(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const classId = req.nextUrl.searchParams.get("classId");

  const assignments = await prisma.assignment.findMany({
    where: {
      class: { teacherId: auth.teacherId },
      ...(classId ? { classId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      class: { select: { id: true, name: true, year: true } },
      rubricTemplate: { select: { id: true, name: true } },
      _count: { select: { rounds: true } },
    },
  });

  return ok(assignments);
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

  const parsed = createAssignmentSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");
  const v = parsed.data;

  // 학급 소유권
  const cls = await prisma.class.findUnique({
    where: { id: v.classId },
    select: { teacherId: true },
  });
  if (!cls) return fail("학급을 찾을 수 없습니다.", 404);
  if (cls.teacherId !== auth.teacherId) return fail("권한이 없습니다.", 403);

  // 루브릭 접근권 (본인 것 or 관리자 시드)
  const rubric = await prisma.rubricTemplate.findUnique({
    where: { id: v.rubricTemplateId },
    include: { teacher: { select: { role: true } } },
  });
  if (!rubric) return fail("루브릭을 찾을 수 없습니다.", 404);
  if (rubric.teacherId !== auth.teacherId && rubric.teacher.role !== "admin") {
    return fail("이 루브릭을 사용할 권한이 없습니다.", 403);
  }

  // 회차 계획 (정기만)
  let plans: { roundNumber: number; deadline: Date }[] = [];
  if (v.type === "REGULAR") {
    const start = new Date(v.startDate!);
    const end = new Date(v.endDate!);
    if (start > end) return fail("종료일은 시작일 이후여야 합니다.");
    plans = planRounds({
      frequency: v.frequency!,
      dayOfWeek: v.dayOfWeek ?? null,
      startDate: start,
      endDate: end,
    });
    if (plans.length === 0) {
      return fail("주어진 기간에 생성될 회차가 없습니다. 기간/요일을 확인하세요.");
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: {
        classId: v.classId,
        rubricTemplateId: v.rubricTemplateId,
        title: v.title,
        description: v.description ?? null,
        type: v.type,
        writingType: v.writingType,
        minChars: v.minChars ?? null,
        recommendedChars: v.recommendedChars ?? null,
        frequency: v.frequency ?? null,
        dayOfWeek: v.dayOfWeek ?? null,
        startDate: v.startDate ? new Date(v.startDate) : null,
        endDate: v.endDate ? new Date(v.endDate) : null,
        deadline: v.deadline ? new Date(v.deadline) : null,
        autoApprove: v.autoApprove,
        showScoreToStudent: v.showScoreToStudent,
        aiPromptNote: v.aiPromptNote ?? null,
      },
    });

    if (v.type === "REGULAR") {
      await tx.assignmentRound.createMany({
        data: plans.map((p) => ({
          assignmentId: a.id,
          roundNumber: p.roundNumber,
          deadline: p.deadline,
        })),
      });
    } else {
      // 비정기는 단일 회차로 모델링
      await tx.assignmentRound.create({
        data: {
          assignmentId: a.id,
          roundNumber: 1,
          deadline: new Date(v.deadline!),
        },
      });
    }

    return a;
  });

  return ok(
    {
      id: created.id,
      roundCount: v.type === "REGULAR" ? plans.length : 1,
    },
    { status: 201 }
  );
}
