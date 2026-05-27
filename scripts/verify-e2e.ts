/**
 * 실연결 검증 스크립트 (일회성)
 * 실행: npx dotenv -e .env.local -- tsx scripts/verify-e2e.ts
 *
 * 1) Supabase DB (Prisma) 연결 + 시드 데이터 확인
 * 2) Supabase Storage 버킷 존재 확인 (REST)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

async function checkDb() {
  console.log("── 1) DB 연결 (Prisma → Supabase) ──");
  try {
    const [teachers, rubrics, classes, students, assignments, submissions] =
      await Promise.all([
        prisma.teacher.count(),
        prisma.rubricTemplate.count(),
        prisma.class.count(),
        prisma.student.count(),
        prisma.assignment.count(),
        prisma.submission.count(),
      ]);
    console.log("   ✅ 연결 성공");
    console.log(
      `   교사 ${teachers} · 루브릭 ${rubrics} · 학급 ${classes} · 학생 ${students} · 과제 ${assignments} · 제출 ${submissions}`
    );
    const admin = await prisma.teacher.findFirst({
      where: { role: "admin" },
      select: { email: true, name: true },
    });
    console.log(
      admin
        ? `   관리자 시드: ${admin.name} <${admin.email}>`
        : "   ⚠️  관리자 계정 없음 (npm run db:seed 필요)"
    );
    const seedRubric = await prisma.rubricTemplate.findFirst({
      select: { name: true, totalScore: true },
    });
    console.log(
      seedRubric
        ? `   기본 루브릭: ${seedRubric.name} (${seedRubric.totalScore}점)`
        : "   ⚠️  루브릭 없음"
    );
    return true;
  } catch (e) {
    console.log("   ❌ 실패:", (e as Error).message);
    return false;
  }
}

async function checkStorage() {
  console.log("\n── 2) Supabase Storage 버킷 ──");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_OCR_BUCKET || "ocr-images";
  if (!url || !key) {
    console.log("   ❌ SUPABASE URL/SERVICE_ROLE_KEY 미설정");
    return false;
  }
  try {
    const res = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    if (res.ok) {
      const b = (await res.json()) as { name: string; public: boolean };
      console.log(`   ✅ 버킷 '${b.name}' 존재 (public=${b.public})`);
      return true;
    }
    if (res.status === 404) {
      console.log(
        `   ❌ 버킷 '${bucket}' 없음 → Supabase 콘솔 Storage에서 생성 필요 (private 권장)`
      );
      return false;
    }
    console.log(`   ❌ 조회 실패 (${res.status}): ${await res.text().catch(() => "")}`);
    return false;
  } catch (e) {
    console.log("   ❌ 네트워크 오류:", (e as Error).message);
    return false;
  }
}

async function checkAiKeys() {
  console.log("\n── 3) AI 키 설정 여부 ──");
  console.log(
    `   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
  );
  console.log(
    `   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
  );
}

async function main() {
  await checkDb();
  await checkStorage();
  await checkAiKeys();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
