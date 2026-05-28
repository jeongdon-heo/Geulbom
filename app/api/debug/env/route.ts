import { NextResponse } from "next/server";

// ⚠️ 임시 진단용 엔드포인트 — 배포 환경변수 주입 여부 확인 후 삭제할 것.
// 비밀값은 노출하지 않고 "존재 여부(boolean)"만 반환합니다.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasNextauthSecret: !!process.env.NEXTAUTH_SECRET,
    nextauthUrl: process.env.NEXTAUTH_URL ?? null, // 비밀 아님
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  });
}
