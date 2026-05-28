import { NextResponse } from "next/server";

// ⚠️ 임시 진단용 엔드포인트 — 원인 확인 후 삭제할 것.
// 비밀값은 노출하지 않고 "존재 여부(boolean)" + 실제 DB 연결 결과만 반환합니다.
export const dynamic = "force-dynamic";

export async function GET() {
  // 1) 환경변수 주입 여부
  const env = {
    nodeEnv: process.env.NODE_ENV,
    hasNextauthSecret: !!process.env.NEXTAUTH_SECRET,
    nextauthUrl: process.env.NEXTAUTH_URL ?? null, // 비밀 아님
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // 2) Prisma 인스턴스화 + 실제 쿼리가 런타임에서 되는지
  let prismaInit = false;
  let dbQueryOk = false;
  let teacherCount: number | null = null;
  let error: string | null = null;
  try {
    const { prisma } = await import("@/lib/db");
    prismaInit = true; // new PrismaClient()가 던지지 않고 import됨
    teacherCount = await prisma.teacher.count();
    dbQueryOk = true;
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  return NextResponse.json({ env, prismaInit, dbQueryOk, teacherCount, error });
}
