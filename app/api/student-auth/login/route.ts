import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/api";
import {
  STUDENT_COOKIE,
  STUDENT_COOKIE_OPTIONS,
  signStudentToken,
} from "@/lib/student-session";

// ============================================================
// POST /api/student-auth/login
// 이름 + (PIN이 설정되어 있다면 PIN)으로 로그인.
// 학급코드 없이 이름으로 학생을 찾으므로, 동명이인은 PIN으로 구분합니다.
// 그래도 한 명으로 좁혀지지 않으면(같은 이름 + 같은 PIN 상황 등) 거부합니다.
// 성공 시 학생 JWT를 HTTP-only 쿠키에 심습니다.
// ============================================================

const schema = z.object({
  name: z.string().min(1, "이름을 입력해주세요.").max(50),
  pin: z.string().max(10).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값 오류");

  const name = parsed.data.name.trim();
  const inputPin = parsed.data.pin?.trim() || null;

  // 이름으로 후보 조회 (소속 학급도 함께)
  const candidates = await prisma.student.findMany({
    where: { name },
    include: { class: { select: { id: true, name: true } } },
  });
  if (candidates.length === 0)
    return fail("해당 이름의 학생을 찾을 수 없어요. 이름을 다시 확인해주세요.", 404);

  // PIN 검증을 통과하는 후보만 추림
  // - PIN이 설정된 학생: 입력 PIN과 bcrypt 비교가 맞아야 통과
  // - PIN이 없는 학생: 입력 PIN도 없을 때만 통과(불필요한 PIN 입력은 무시하지 않고 그대로 통과 처리)
  const matched: typeof candidates = [];
  let needPin = false;
  for (const c of candidates) {
    if (c.pin) {
      if (!inputPin) {
        needPin = true;
        continue;
      }
      if (await bcrypt.compare(inputPin, c.pin)) matched.push(c);
    } else {
      matched.push(c);
    }
  }

  if (matched.length === 0) {
    if (needPin) return fail("PIN을 입력해주세요.", 401);
    return fail("PIN이 일치하지 않습니다.", 401);
  }
  if (matched.length > 1) {
    // 같은 이름의 학생이 둘 이상 구분되지 않음 → 안전하게 거부
    return fail(
      "같은 이름의 학생이 여러 명이에요. 선생님께 PIN을 받아 입력해주세요.",
      409
    );
  }

  const student = matched[0];

  const token = await signStudentToken({
    studentId: student.id,
    classId: student.class.id,
    number: student.number,
    name: student.name,
  });

  const res = NextResponse.json({
    success: true,
    data: {
      id: student.id,
      name: student.name,
      number: student.number,
      classId: student.class.id,
      className: student.class.name,
    },
  });
  res.cookies.set(STUDENT_COOKIE, token, STUDENT_COOKIE_OPTIONS);
  return res;
}
