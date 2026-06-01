/**
 * 전체 흐름 e2e 검증 (스크립트, API 라우트 로직 미러링).
 * 실행: npx dotenv -e .env.local -- tsx scripts/verify-flow.ts [gemini|claude] [--keep]
 *
 * 교사가입 → 학급 → 학생 → 과제 → 학생제출 → AI분석 → (게이팅) → 승인 → 학생조회
 * 각 단계에서 실제 API 라우트가 쓰는 Zod 스키마 + lib 헬퍼 + 실제 AI 호출 경로를 그대로 탑니다.
 *
 * 사용자의 초대코드(TQTPJTY6)는 건드리지 않고, 스크립트 전용 일회용 초대코드를 따로 만들어 씁니다.
 * 기본적으로 끝나면 테스트 데이터(교사 → 학급/학생/과제/제출/피드백 cascade)를 삭제합니다.
 * --keep 를 주면 데이터를 남겨 Prisma Studio로 확인할 수 있습니다.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  registerSchema,
  createClassSchema,
  createStudentSchema,
  createAssignmentSchema,
  submissionUpsertSchema,
} from "../lib/validations";
import { generateClassCode, generateInviteCode } from "../lib/codes";
import { getAI, type AIProvider } from "../lib/ai";
import { buildAnalysisPrompt } from "../lib/prompts";
import { analysisResponseSchema } from "../lib/ai-schemas";

const prisma = new PrismaClient({ log: ["error"] });

const TEST_EMAIL = "e2e-test@geulbom.local";
const SAMPLE_TEXT = `오늘은 학교에서 친구들과 운동장에서 축구를 했다. 처음에는 우리 팀이 지고 있어서 속상했는데, 내가 마지막에 골을 넣어서 비겼다. 친구들이 잘했다고 박수를 쳐줘서 정말 기분이 좋았다. 땀이 많이 났지만 시원한 바람이 불어서 상쾌했다. 다음에도 또 축구를 하고 싶다.`;

let pass = 0;
let failCount = 0;
function step(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else failCount++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) throw new Error(`단계 실패: ${name} ${detail}`);
}

// 기존 테스트 교사 + 그 교사가 쓴 초대코드만 정리 (cascade로 학급/학생/과제/제출/피드백 삭제됨).
// ⚠️ 다른 초대코드(사용자가 발급한 것)는 절대 건드리지 않는다.
async function reset() {
  const t = await prisma.teacher.findUnique({ where: { email: TEST_EMAIL } });
  if (t) {
    await prisma.inviteCode.deleteMany({ where: { usedBy: t.id } });
    await prisma.teacher.delete({ where: { id: t.id } });
  }
}

async function main() {
  const provider = (process.argv.includes("claude") ? "claude" : process.argv.includes("gemini") ? "gemini" : "claude") as AIProvider;
  const keep = process.argv.includes("--keep");
  console.log(`\n══ 글봄 전체 흐름 e2e (provider=${provider}${keep ? ", --keep" : ""}) ══\n`);

  await reset();
  step("0. 이전 테스트 데이터 정리", true);

  // ── 1. 교사 가입 (POST /api/teachers/register 미러) ──
  const inviteCode = generateInviteCode();
  await prisma.inviteCode.create({
    data: { code: inviteCode, isActive: true, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) },
  });
  const regInput = { email: TEST_EMAIL, password: "test1234", name: "테스트교사", school: "글봄초", inviteCode };
  const reg = registerSchema.safeParse(regInput);
  step("1a. registerSchema 검증", reg.success, reg.success ? "" : JSON.stringify(reg.error?.issues[0]));
  const invite = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });
  const teacher = await prisma.$transaction(async (tx) => {
    const created = await tx.teacher.create({
      data: { email: TEST_EMAIL, password: await bcrypt.hash("test1234", 10), name: "테스트교사", school: "글봄초", role: "teacher" },
    });
    await tx.inviteCode.update({ where: { id: invite!.id }, data: { usedBy: created.id, usedAt: new Date(), isActive: false } });
    return created;
  });
  step("1b. 교사 생성 + 초대코드 소진", !!teacher.id, `id=${teacher.id.slice(0, 8)}`);

  // ── 2. 학급 생성 (POST /api/classes 미러) ──
  const clsInput = { name: "4학년 2반", year: 2026 };
  step("2a. createClassSchema 검증", createClassSchema.safeParse(clsInput).success);
  const cls = await prisma.class.create({
    data: { teacherId: teacher.id, name: clsInput.name, year: clsInput.year, classCode: generateClassCode() },
  });
  step("2b. 학급 생성 + 학급코드 발급", /^GB-[A-Z2-9]{6}$/.test(cls.classCode), `classCode=${cls.classCode}`);

  // ── 3. 학생 등록 (POST /api/students 미러) ──
  const stuInput = { classId: cls.id, number: 1, name: "김글봄", pin: "1234" };
  step("3a. createStudentSchema 검증", createStudentSchema.safeParse(stuInput).success);
  const student = await prisma.student.create({
    data: { classId: cls.id, number: 1, name: "김글봄", pin: await bcrypt.hash("1234", 10) },
  });
  step("3b. 학생 생성 (PIN 해시)", !!student.id && student.pin !== "1234");

  // ── 4. 과제 생성 (POST /api/assignments 미러, IRREGULAR 단일 회차) ──
  const rubric = await prisma.rubricTemplate.findFirst({ orderBy: { createdAt: "asc" } });
  step("4a. 시드 루브릭 존재", !!rubric, rubric ? `${rubric.name} (${rubric.totalScore}점)` : "없음");
  const asgInput = {
    classId: cls.id,
    rubricTemplateId: rubric!.id,
    title: "현장체험학습 소감문",
    type: "IRREGULAR" as const,
    writingType: "소감문",
    minChars: 100,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };
  const asgParsed = createAssignmentSchema.safeParse(asgInput);
  step("4b. createAssignmentSchema 검증", asgParsed.success, asgParsed.success ? "" : JSON.stringify(asgParsed.error?.issues[0]));
  const { assignment, round } = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: {
        classId: cls.id, rubricTemplateId: rubric!.id, title: asgInput.title,
        type: "IRREGULAR", writingType: "소감문", minChars: 100, autoApprove: false, showScoreToStudent: true,
        deadline: new Date(asgInput.deadline),
      },
    });
    const r = await tx.assignmentRound.create({ data: { assignmentId: a.id, roundNumber: 1, deadline: new Date(asgInput.deadline) } });
    return { assignment: a, round: r };
  });
  step("4c. 과제 + 회차 생성 (autoApprove=false)", !!assignment.id && !!round.id);

  // ── 5. 학생 제출 (POST /api/submissions 미러, action=SUBMIT) ──
  const subInput = { assignmentRoundId: round.id, text: SAMPLE_TEXT, inputMethod: "TYPED" as const, action: "SUBMIT" as const };
  step("5a. submissionUpsertSchema 검증", submissionUpsertSchema.safeParse(subInput).success);
  const charCount = [...SAMPLE_TEXT].length;
  step("5b. 최소 글자 수 충족", charCount >= assignment.minChars!, `${charCount}자 / 최소 ${assignment.minChars}자`);
  const submission = await prisma.submission.create({
    data: {
      studentId: student.id, assignmentRoundId: round.id, text: SAMPLE_TEXT, charCount,
      inputMethod: "TYPED", status: "SUBMITTED", submittedAt: new Date(),
    },
  });
  step("5c. 제출 생성 (SUBMITTED)", submission.status === "SUBMITTED");

  // ── 6. AI 분석 (POST /api/analyze/feedback 미러) ──
  const full = await prisma.submission.findUnique({
    where: { id: submission.id },
    include: {
      student: { select: { id: true, name: true, classId: true } },
      assignmentRound: { include: { assignment: { include: { class: { select: { teacherId: true } }, rubricTemplate: true } } } },
    },
  });
  step("6a. 소유권 검증", full!.assignmentRound.assignment.class.teacherId === teacher.id);
  const rt = full!.assignmentRound.assignment.rubricTemplate!;
  const prompt = buildAnalysisPrompt({
    studentName: full!.student.name,
    assignmentTitle: full!.assignmentRound.assignment.title,
    roundNumber: full!.assignmentRound.roundNumber,
    writingType: full!.assignmentRound.assignment.writingType,
    text: full!.text,
    charCount: full!.charCount,
    minChars: full!.assignmentRound.assignment.minChars ?? null,
    rubricAreas: rt.areas as unknown as Parameters<typeof buildAnalysisPrompt>[0]["rubricAreas"],
    totalScore: rt.totalScore,
    scoringGuide: rt.scoringGuide as unknown as Parameters<typeof buildAnalysisPrompt>[0]["scoringGuide"],
    previousScores: null,
    previousRound: null,
    aiPromptNote: null,
  });
  console.log(`   …AI(${provider}) 호출 중`);
  const t0 = Date.now();
  const raw = await getAI(provider).generateJSON(prompt);
  step("6b. AI 응답 수신", true, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const validated = analysisResponseSchema.safeParse(raw);
  step("6c. analysisResponseSchema 검증", validated.success, validated.success ? "" : JSON.stringify(validated.error?.issues.slice(0, 3)));
  const vd = validated.data!;
  const sumOfAreas = Object.values(vd.scores).reduce((a, b) => a + b, 0);
  const totalScore = Math.abs(sumOfAreas - vd.totalScore) > 2 ? sumOfAreas : vd.totalScore;
  const feedback = await prisma.feedback.create({
    data: {
      submissionId: submission.id, aiProvider: provider,
      scores: vd.scores as Prisma.InputJsonValue, totalScore,
      feedbackStudent: vd.feedbackStudent as Prisma.InputJsonValue,
      feedbackTeacher: vd.feedbackTeacher as Prisma.InputJsonValue,
      approvalStatus: "PENDING",
    },
  });
  step("6d. 피드백 저장 (PENDING)", feedback.approvalStatus === "PENDING", `총점 ${totalScore}, 영역 ${JSON.stringify(vd.scores)}`);

  // ── 7. 승인 게이팅 A: PENDING은 학생에게 안 보여야 함 ──
  const gatingQuery = () =>
    prisma.feedback.findMany({ where: { approvalStatus: "APPROVED", submission: { studentId: student.id } } });
  const beforeApprove = await gatingQuery();
  step("7. 게이팅 A: PENDING 피드백 학생 비노출", beforeApprove.length === 0, `학생 조회 결과 ${beforeApprove.length}건`);

  // ── 8. 교사 승인 (PATCH /api/feedback/[id] approve=true 미러) ──
  const approved = await prisma.feedback.update({
    where: { id: feedback.id }, data: { approvalStatus: "APPROVED", approvedAt: new Date() },
  });
  step("8. 교사 승인 (APPROVED)", approved.approvalStatus === "APPROVED" && !!approved.approvedAt);

  // ── 9. 승인 게이팅 B: APPROVED는 학생에게 보여야 함 (학생 피드백 목록 쿼리 그대로) ──
  const afterApprove = await gatingQuery();
  step("9. 게이팅 B: APPROVED 피드백 학생 노출", afterApprove.length === 1, `학생 조회 결과 ${afterApprove.length}건`);

  // ── 10. 학생용/교사용 피드백 내용 확인 ──
  const fs = vd.feedbackStudent;
  const ft = vd.feedbackTeacher;
  step("10. 학생용/교사용 피드백 내용 존재", !!fs.praise && !!ft.overall,
    `학생칭찬 "${fs.praise.slice(0, 30)}…" / 교사총평 "${ft.overall.slice(0, 30)}…"`);

  // ── 정리 ──
  if (!keep) {
    await prisma.inviteCode.deleteMany({ where: { usedBy: teacher.id } });
    await prisma.teacher.delete({ where: { id: teacher.id } });
    console.log("\n🧹 테스트 데이터 정리 완료 (교사 cascade 삭제).");
  } else {
    console.log(`\n📌 --keep: 데이터 유지됨. 학급코드=${cls.classCode}, 교사=${TEST_EMAIL}/test1234, 학생=1번 김글봄/PIN 1234`);
  }
}

main()
  .then(() => {
    console.log(`\n══ 결과: ${pass} 통과 / ${failCount} 실패 ══`);
  })
  .catch((e) => {
    console.error(`\n❌ 중단: ${e instanceof Error ? e.message : e}`);
    console.log(`\n══ 결과: ${pass} 통과 / ${failCount} 실패 (중단됨) ══`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
