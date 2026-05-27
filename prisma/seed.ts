// ============================================================
// 글봄 시드 데이터
// - 관리자 교사 계정 (.env의 ADMIN_*)
// - 기본 루브릭 템플릿: "일기 기본형"
// 실행: npm run db:seed  (= tsx prisma/seed.ts)
// ============================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 기본 루브릭 데이터 (GEULBOM-SPEC.md §4 그대로)
const DEFAULT_RUBRIC = {
  name: "일기 기본형",
  totalScore: 100,
  areas: [
    {
      key: "content",
      name: "내용",
      maxScore: 20,
      description: "주제에 맞는 내용을 풍부하게 썼는가",
    },
    {
      key: "structure",
      name: "구성",
      maxScore: 20,
      description: "글의 흐름이 자연스럽고, 문단이 구분되어 있는가",
    },
    {
      key: "expression",
      name: "표현",
      maxScore: 20,
      description: "다양한 어휘와 비유, 생생한 묘사를 사용했는가",
    },
    {
      key: "grammar",
      name: "맞춤법·문법",
      maxScore: 20,
      description: "맞춤법, 띄어쓰기, 문법이 정확한가",
    },
    {
      key: "volume",
      name: "분량",
      maxScore: 20,
      description: "최소 글자 수를 충족하고, 내용에 비해 적절한 양인가",
    },
  ],
  scoringGuide: {
    content: {
      high: "18~20: 주제를 깊이 있게 다루고, 자신의 경험·생각·느낌이 구체적으로 드러남",
      mid: "13~17: 주제에 맞는 내용이나, 구체적 사례나 깊이가 부족함",
      low: "~12: 주제와 관련 없는 내용이 많거나, 내용이 매우 빈약함",
    },
    structure: {
      high: "18~20: 처음-중간-끝이 뚜렷하고, 문장 간 연결이 자연스러움",
      mid: "13~17: 흐름은 있으나 문단 구분이 없거나, 연결이 어색한 부분이 있음",
      low: "~12: 나열식으로 시간순 사건만 나열, 글의 구조가 없음",
    },
    expression: {
      high: "18~20: 비유, 의성어/의태어, 감각적 묘사가 2회 이상, 다양한 어휘 사용",
      mid: "13~17: 표현 시도는 있으나 단조로움. '재미있었다', '좋았다' 등 반복",
      low: "~12: 거의 모든 문장이 '~했다'로 끝남, 반복 표현만 사용",
    },
    grammar: {
      high: "18~20: 맞춤법·띄어쓰기 오류 0~1개",
      mid: "13~17: 오류 2~5개, 대체로 읽는 데 지장 없음",
      low: "~12: 오류 6개 이상, 읽기에 불편을 줌",
    },
    volume: {
      high: "18~20: 최소 기준의 150% 이상, 내용에 비해 충분한 양",
      mid: "13~17: 최소 기준 충족~130%, 조금 더 쓸 수 있었음",
      low: "~12: 최소 기준 미달, 또는 의미 없는 반복으로 양만 채움",
    },
  },
};

async function main() {
  console.log("🌱 글봄 시드 시작");

  // ── 1) 관리자 교사 ──
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "관리자";

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "ADMIN_EMAIL / ADMIN_PASSWORD 환경 변수가 필요합니다. .env.local을 확인하세요."
    );
  }

  const hashed = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.teacher.upsert({
    where: { email: adminEmail },
    update: {
      // 기존 관리자는 권한·이름만 동기화 (비밀번호는 덮어쓰지 않음)
      name: adminName,
      role: "admin",
    },
    create: {
      email: adminEmail,
      password: hashed,
      name: adminName,
      role: "admin",
    },
  });

  console.log(`  ✓ 관리자 계정 준비: ${admin.email} (id=${admin.id})`);

  // ── 2) 기본 루브릭 (관리자 소유) ──
  // 동일 이름의 루브릭이 이미 있으면 업데이트, 없으면 생성
  const existing = await prisma.rubricTemplate.findFirst({
    where: { teacherId: admin.id, name: DEFAULT_RUBRIC.name },
  });

  if (existing) {
    await prisma.rubricTemplate.update({
      where: { id: existing.id },
      data: {
        totalScore: DEFAULT_RUBRIC.totalScore,
        areas: DEFAULT_RUBRIC.areas,
        scoringGuide: DEFAULT_RUBRIC.scoringGuide,
      },
    });
    console.log(`  ✓ 기본 루브릭 갱신: ${DEFAULT_RUBRIC.name}`);
  } else {
    await prisma.rubricTemplate.create({
      data: {
        teacherId: admin.id,
        name: DEFAULT_RUBRIC.name,
        totalScore: DEFAULT_RUBRIC.totalScore,
        areas: DEFAULT_RUBRIC.areas,
        scoringGuide: DEFAULT_RUBRIC.scoringGuide,
      },
    });
    console.log(`  ✓ 기본 루브릭 생성: ${DEFAULT_RUBRIC.name}`);
  }

  console.log("✅ 시드 완료");
}

main()
  .catch((e) => {
    console.error("❌ 시드 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
