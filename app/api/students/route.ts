import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";
import {
  bulkCreateStudentsSchema,
  createStudentSchema,
} from "@/lib/validations";

// ============================================================
// GET  /api/students?classId=...    학급 학생 목록
// POST /api/students                단건 추가 (body에 classId)
// PUT  /api/students                일괄 추가
// ============================================================

/** 학급 소유권 검증 */
async function assertOwnsClass(classId: string, teacherId: string) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true },
  });
  if (!cls) return { ok: false as const, status: 404, message: "학급을 찾을 수 없습니다." };
  if (cls.teacherId !== teacherId)
    return { ok: false as const, status: 403, message: "권한이 없습니다." };
  return { ok: true as const };
}

/** PIN은 해시해서 저장. 빈 값은 null. */
async function hashPin(pin: string | null | undefined): Promise<string | null> {
  if (!pin) return null;
  return bcrypt.hash(pin, 10);
}

export async function GET(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const classId = req.nextUrl.searchParams.get("classId");
  if (!classId) return fail("classId 쿼리 파라미터가 필요합니다.");

  const own = await assertOwnsClass(classId, auth.teacherId);
  if (!own.ok) return fail(own.message, own.status);

  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      name: true,
      classId: true,
      createdAt: true,
      // PIN 해시는 노출 금지
      pin: false,
    },
  });
  return ok(students);
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

  const parsed = createStudentSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const own = await assertOwnsClass(parsed.data.classId, auth.teacherId);
  if (!own.ok) return fail(own.message, own.status);

  try {
    const created = await prisma.student.create({
      data: {
        classId: parsed.data.classId,
        number: parsed.data.number,
        name: parsed.data.name,
        pin: await hashPin(parsed.data.pin ?? null),
      },
      select: { id: true, number: true, name: true, classId: true, createdAt: true },
    });
    return ok(created, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("이미 사용 중인 출석번호입니다.", 409);
    }
    throw e;
  }
}

/** 일괄 추가: 부분 실패 허용 (이미 존재하는 번호는 skip하고 결과로 알림) */
export async function PUT(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = bulkCreateStudentsSchema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const own = await assertOwnsClass(parsed.data.classId, auth.teacherId);
  if (!own.ok) return fail(own.message, own.status);

  // 클라이언트 보낸 번호들 중 중복 검사
  const numbers = parsed.data.students.map((s) => s.number);
  const dupInBody = numbers.length !== new Set(numbers).size;
  if (dupInBody) return fail("같은 출석번호가 두 번 이상 포함되어 있습니다.");

  const existing = await prisma.student.findMany({
    where: { classId: parsed.data.classId, number: { in: numbers } },
    select: { number: true },
  });
  const taken = new Set(existing.map((e) => e.number));

  const toCreate = parsed.data.students.filter((s) => !taken.has(s.number));
  const skipped = parsed.data.students.filter((s) => taken.has(s.number));

  // PIN 해시는 병렬로
  const dataWithPin = await Promise.all(
    toCreate.map(async (s) => ({
      classId: parsed.data.classId,
      number: s.number,
      name: s.name,
      pin: await hashPin(s.pin ?? null),
    }))
  );

  if (dataWithPin.length > 0) {
    await prisma.student.createMany({ data: dataWithPin });
  }

  return ok(
    {
      createdCount: dataWithPin.length,
      skippedCount: skipped.length,
      skippedNumbers: skipped.map((s) => s.number),
    },
    { status: 201 }
  );
}
