import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { registerSchema } from "@/lib/validations";

// ============================================================
// POST /api/teachers/register
// 교사 회원가입. 유효한 초대코드(InviteCode)가 있어야 가입 가능.
// ============================================================

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? "입력값을 확인해주세요.");
  }

  const { email, password, name, school, inviteCode } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = inviteCode.toUpperCase();

  // 이메일 중복 체크
  const existing = await prisma.teacher.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) return fail("이미 가입된 이메일입니다.", 409);

  // 초대코드 검증
  const invite = await prisma.inviteCode.findUnique({
    where: { code: normalizedCode },
  });
  if (!invite) return fail("존재하지 않는 초대코드입니다.", 404);
  if (!invite.isActive) return fail("비활성화된 초대코드입니다.", 410);
  if (invite.usedBy) return fail("이미 사용된 초대코드입니다.", 409);
  if (invite.expiresAt.getTime() < Date.now())
    return fail("만료된 초대코드입니다.", 410);

  // 트랜잭션: 교사 생성 + 초대코드 소진
  const hashed = await bcrypt.hash(password, 10);

  const teacher = await prisma.$transaction(async (tx) => {
    const created = await tx.teacher.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        name,
        school: school ?? null,
        role: "teacher",
      },
    });
    await tx.inviteCode.update({
      where: { id: invite.id },
      data: {
        usedBy: created.id,
        usedAt: new Date(),
        isActive: false,
      },
    });
    return created;
  });

  return ok(
    {
      id: teacher.id,
      email: teacher.email,
      name: teacher.name,
    },
    { status: 201 }
  );
}
