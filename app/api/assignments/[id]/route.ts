import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";

// ============================================================
// /api/assignments/[id]
// GET    상세 (회차 + 제출 통계 포함)
// DELETE 삭제
// PATCH  isActive 토글 등 간단 업데이트
// ============================================================

async function loadOwned(id: string, teacherId: string) {
  const a = await prisma.assignment.findUnique({
    where: { id },
    include: { class: { select: { teacherId: true } } },
  });
  if (!a) return { ok: false as const, status: 404, message: "과제를 찾을 수 없습니다." };
  if (a.class.teacherId !== teacherId)
    return { ok: false as const, status: 403, message: "권한이 없습니다." };
  return { ok: true as const, assignment: a };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const res = await loadOwned(params.id, auth.teacherId);
  if (!res.ok) return fail(res.message, res.status);

  const detail = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: {
      class: { select: { id: true, name: true, year: true } },
      rubricTemplate: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { _count: { select: { submissions: true } } },
      },
    },
  });
  return ok(detail);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const res = await loadOwned(params.id, auth.teacherId);
  if (!res.ok) return fail(res.message, res.status);

  let json: { isActive?: boolean; autoApprove?: boolean; showScoreToStudent?: boolean } = {};
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const data: typeof json = {};
  if (typeof json.isActive === "boolean") data.isActive = json.isActive;
  if (typeof json.autoApprove === "boolean") data.autoApprove = json.autoApprove;
  if (typeof json.showScoreToStudent === "boolean")
    data.showScoreToStudent = json.showScoreToStudent;

  if (Object.keys(data).length === 0) return fail("변경할 항목이 없습니다.");

  const updated = await prisma.assignment.update({
    where: { id: params.id },
    data,
  });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const res = await loadOwned(params.id, auth.teacherId);
  if (!res.ok) return fail(res.message, res.status);

  await prisma.assignment.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
