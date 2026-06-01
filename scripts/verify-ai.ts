/**
 * AI 실호출 검증 (일회성).
 * 실행: npx dotenv -e .env.local -- tsx scripts/verify-ai.ts [gemini|claude]
 *
 * 시드 루브릭으로 실제 글쓰기 분석을 호출하고, lib/ai-schemas의 Zod 검증을 통과하는지 확인합니다.
 */
import { PrismaClient } from "@prisma/client";
import { getAI, type AIProvider } from "../lib/ai";
import { buildAnalysisPrompt } from "../lib/prompts";
import { analysisResponseSchema } from "../lib/ai-schemas";

const prisma = new PrismaClient({ log: ["error"] });

const SAMPLE_TEXT = `오늘은 학교에서 친구들과 운동장에서 축구를 했다. 처음에는 우리 팀이 지고 있어서 속상했는데, 내가 마지막에 골을 넣어서 비겼다. 친구들이 잘했다고 박수를 쳐줘서 정말 기분이 좋았다. 땀이 많이 났지만 시원한 바람이 불어서 상쾌했다. 다음에도 또 축구를 하고 싶다.`;

async function main() {
  const provider = (process.argv[2] === "claude" ? "claude" : "gemini") as AIProvider;
  console.log(`── AI 분석 실호출 검증 (provider=${provider}) ──`);

  const rubric = await prisma.rubricTemplate.findFirst({ orderBy: { createdAt: "asc" } });
  if (!rubric) {
    console.log("❌ 루브릭이 없습니다. npm run db:seed 먼저 실행하세요.");
    return;
  }
  console.log(`루브릭: ${rubric.name} (${rubric.totalScore}점)`);

  const prompt = buildAnalysisPrompt({
    studentName: "테스트학생",
    assignmentTitle: "오늘의 일기",
    roundNumber: 1,
    writingType: "일기",
    assignmentDescription: null,
    text: SAMPLE_TEXT,
    charCount: SAMPLE_TEXT.length,
    minChars: 100,
    // Json 컬럼 → unknown을 거쳐 프롬프트 빌더 타입으로 단언
    rubricAreas: rubric.areas as unknown as Parameters<
      typeof buildAnalysisPrompt
    >[0]["rubricAreas"],
    totalScore: rubric.totalScore,
    scoringGuide: rubric.scoringGuide as unknown as Parameters<
      typeof buildAnalysisPrompt
    >[0]["scoringGuide"],
    previousScores: null,
    previousRound: null,
    aiPromptNote: null,
  });

  const t0 = Date.now();
  let raw: unknown;
  try {
    const ai = getAI(provider);
    raw = await ai.generateJSON(prompt);
  } catch (e) {
    console.log(`❌ AI 호출 실패: ${(e as Error).message}`);
    return;
  }
  console.log(`AI 응답 수신 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  const parsed = analysisResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.log("❌ Zod 검증 실패 — 응답이 기대 형식과 다릅니다:");
    console.log(JSON.stringify(parsed.error.issues.slice(0, 5), null, 2));
    console.log("\n--- 실제 응답(앞 1500자) ---");
    console.log(JSON.stringify(raw).slice(0, 1500));
    return;
  }

  const d = parsed.data;
  console.log("✅ Zod 검증 통과");
  console.log(`   총점: ${d.totalScore} / 영역 점수:`, d.scores);
  console.log(`   학생 칭찬: ${d.feedbackStudent.praise.slice(0, 60)}…`);
  console.log(`   교사 총평: ${d.feedbackTeacher.overall.slice(0, 60)}…`);
}

main()
  .catch((e) => {
    console.error("오류:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
