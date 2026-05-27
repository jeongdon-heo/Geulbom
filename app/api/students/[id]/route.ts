import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import { updateStudentSchema } from "@/lib/validations";

// ============================================================
// /api/students/[id]
// ============================================================

async function loadOwned(id: string, teacherId: string) {
  const s = await prisma.student.findUnique({
    where: { id },
    include: { class: { select: { teacherId: true } } },
  });
  if (!s) return { ok: false as const, status: 404, message: "학생을 찾을 수 없습니다." };
  if (s.class.teacherId !== teacherId)
    return { ok: false as const, status: 403, message: "권한이 없습니다." };
  return { ok: true as const, student: s };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const res = await loadOwned(params.id, auth.teacherId);
  if (!res.ok) return fail(res.message, res.status);

  // PIN 해시 제외하고 반환
  const { pin: _pin, class: _class, ...safe } = res.student;
  return ok(safe);
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

  const parsed = updateStudentSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const data: { number?: number; name?: string; pin?: string | null } = {};
  if (parsed.data.number !== undefined) data.number = parsed.data.number;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.pin !== undefined) {
    data.pin = parsed.data.pin ? await bcrypt.hash(parsed.data.pin, 10) : null;
  }

  try {
    const updated = await prisma.student.update({
      where: { id: params.id },
      data,
      select: { id: true, number: true, name: true, classId: true, createdAt: true },
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("이미 사용 중인 출석번호입니다.", 409);
    }
    throw e;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const res = await loadOwned(params.id, auth.teacherId);
  if (!res.ok) return fail(res.message, res.status);

  await prisma.student.delete({ where: { id: params.id } });
  return ok({ id: params.id });
}
