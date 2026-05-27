/** 교사 회원가입용 초대코드 발급 (일회성). 실행: npx dotenv -e .env.local -- tsx scripts/make-invite.ts */
import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";

const prisma = new PrismaClient({ log: ["error"] });
// 회원가입 검증 정규식(/^[A-Z0-9]+$/)에 맞춰 대문자+숫자만, 헷갈리는 글자 제외
const gen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

async function main() {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일
  const c = await prisma.inviteCode.create({ data: { code: gen(), expiresAt } });
  console.log("초대코드:", c.code);
  console.log("만료:", c.expiresAt.toISOString().slice(0, 10));
}

main()
  .catch((e) => {
    console.error("발급 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
