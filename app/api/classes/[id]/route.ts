import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { updateClassSchema } from "@/lib/validations";

// ============================================================
// /api/classes/[id]
// ============================================================

async function loadOwned(id: string, teacherId: string) {
  const cls = await prisma.class.findUnique({ where: { id } });
  if (!cls) return { ok: false as const, status: 404, message: "학급을 찾을 수 없습니다." };
  if (cls.teacherId !== teacherId)
    return { ok: false as const, status: 403, message: "권한이 없습니다." };
  return { ok: true as const, cls };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const res = await loadOwned(params.id, auth.teacherId);
  if (!res.ok) return fail(res.message, res.status);

  const detail = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      students: { orderBy: { number: "asc" } },
      _count: { select: { assignments: true } },
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = updateClassSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const updated = await prisma.class.update({
    where: { id: params.id },
    data: parsed.data,
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

  await prisma.class.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
