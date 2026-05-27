import { NextRequest } from "next/server";
import { customAlphabet } from "nanoid";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { createInviteCodeSchema } from "@/lib/validations";

// ============================================================
// 초대코드 (관리자 전용)
// GET  목록 조회
// POST 신규 발급 (대량 가능)
// ============================================================

// 헷갈리는 글자(0,O,1,I) 제거한 8자 코드
const generateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false as const, status: 401, message: "로그인이 필요합니다." };
  if (session.user.role !== "admin")
    return { ok: false as const, status: 403, message: "관리자 권한이 필요합니다." };
  return { ok: true as const, session };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  const codes = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { teacher: { select: { email: true, name: true } } },
  });

  return ok(codes);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.message, auth.status);

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    /* 본문 없이 호출하면 기본값 사용 */
  }

  const parsed = createInviteCodeSchema.safeParse(json);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "입력값 오류");
  }

  const { count, expiresInDays } = parsed.data;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  // 충돌 가능성 매우 낮지만 보수적으로 createMany + 재시도 대신 개별 create로
  const created = [];
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    while (attempts < 5) {
      try {
        const c = await prisma.inviteCode.create({
          data: { code: generateCode(), expiresAt },
        });
        created.push(c);
        break;
      } catch (e: unknown) {
        // unique 충돌이면 재시도, 그 외는 throw
        const code = (e as { code?: string })?.code;
        if (code !== "P2002") throw e;
        attempts++;
      }
    }
  }

  return ok(created, { status: 201 });
}
