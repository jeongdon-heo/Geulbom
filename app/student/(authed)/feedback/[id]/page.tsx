import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStudentSession } from "@/lib/student-session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface StudentFb {
  praise: string;
  suggestion: string;
  encouragement: string;
}

interface TeacherFbGrammar {
  original: string;
  corrected: string;
  type: string;
  explanation: string;
}

const AREA_COLOR: Record<string, string> = {
  content: "text-area-content",
  structure: "text-area-structure",
  expression: "text-area-expression",
  grammar: "text-area-grammar",
  volume: "text-area-volume",
};

export default async function StudentFeedbackDetailPage({
  params,
}: {
  params: { id: string }; // submission id
}) {
  const s = (await getStudentSession())!;

  // 본인 제출물만 + 승인된 피드백만 노출
  const submission = await prisma.submission.findUnique({
    where: { id: params.id },
    include: {
      student: { select: { id: true } },
      assignmentRound: {
        include: {
          assignment: {
            include: { rubricTemplate: true },
          },
        },
      },
      feedback: true,
    },
  });

  if (!submission) notFound();
  if (submission.student.id !== s.studentId) redirect("/student/home");
  if (!submission.feedback || submission.feedback.approvalStatus !== "APPROVED") {
    return (
      <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl">
        <Link href="/student/home" className="text-sm text-gray-500">
          ← 홈
        </Link>
        <div className="card mt-3">
          <p className="text-sm text-gray-700">아직 선생님이 확인 중이에요. 조금만 기다려요.</p>
        </div>
      </main>
    );
  }

  const fb = submission.feedback;
  const showScore = submission.assignmentRound.assignment.showScoreToStudent;
  const rubric = submission.assignmentRound.assignment.rubricTemplate!;
  const areas = rubric.areas as unknown as { key: string; name: string; maxScore: number }[];
  // 교사가 수정한 버전이 있으면 그것을, 없으면 AI 원본
  const studentFb = (fb.teacherEditedStudent ?? fb.feedbackStudent) as unknown as StudentFb;
  const grammarErrors = (fb.feedbackTeacher as unknown as { grammarErrors: TeacherFbGrammar[] })
    .grammarErrors;
  const scores = fb.scores as unknown as Record<string, number>;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl">
      <Link href="/student/feedback" className="text-sm text-gray-500">
        ← 피드백
      </Link>

      <header className="mt-3">
        <p className="text-xs text-gray-500">
          {submission.assignmentRound.assignment.writingType} ·{" "}
          {submission.assignmentRound.roundNumber}회차
        </p>
        <h1 className="text-xl font-bold text-gray-900">
          {submission.assignmentRound.assignment.title}
        </h1>
      </header>

      {/* 점수 (옵션) */}
      {showScore && (
        <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-end justify-between">
            <p className="text-sm text-gray-500">내 점수</p>
            <p className="text-2xl font-bold text-teal-700">
              {fb.totalScore}
              <span className="ml-1 text-sm font-normal text-gray-500">
                / {rubric.totalScore}
              </span>
            </p>
          </div>
          <ul className="space-y-2">
            {areas.map((a) => {
              const score = scores[a.key] ?? 0;
              const pct = (score / a.maxScore) * 100;
              return (
                <li key={a.key}>
                  <div className="mb-0.5 flex items-center justify-between text-xs">
                    <span className={`font-medium ${AREA_COLOR[a.key] ?? "text-gray-700"}`}>
                      {a.name}
                    </span>
                    <span className="text-gray-500">
                      {score} / {a.maxScore}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-current opacity-70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 선생님 피드백 */}
      <section className="mt-5 space-y-3">
        <FeedbackBlock title="잘한 점" body={studentFb.praise} tone="teal" />
        <FeedbackBlock title="이렇게 해보면 좋아요" body={studentFb.suggestion} tone="amber" />
        <FeedbackBlock title="응원의 말" body={studentFb.encouragement} tone="purple" />
        {fb.teacherComment && (
          <FeedbackBlock
            title="선생님이 직접 남긴 말"
            body={fb.teacherComment}
            tone="gray"
          />
        )}
      </section>

      {/* 맞춤법 고치기 */}
      {grammarErrors.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            맞춤법 고치기
          </h2>
          <ul className="space-y-1.5">
            {grammarErrors.map((g, i) => (
              <li key={i} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <span className="line-through text-area-grammar">{g.original}</span>{" "}
                <span className="text-gray-400">→</span>{" "}
                <span className="font-semibold text-gray-900">{g.corrected}</span>
                {g.explanation && (
                  <p className="mt-1 text-xs text-gray-500">{g.explanation}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 내가 쓴 글 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          내가 쓴 글
        </h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {submission.text}
          </p>
          <p className="mt-3 text-xs text-gray-400">
            {submission.charCount}자
            {submission.submittedAt &&
              ` · 제출 ${new Date(submission.submittedAt).toLocaleDateString("ko-KR")}`}
          </p>
        </div>

        {/* 고쳐 쓴 글 (선생님이 다듬어 준 글) */}
        {fb.correctedText && (
          <div className="mt-3 rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
              고쳐 쓴 글
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {fb.correctedText}
            </p>
            <p className="mt-2 text-xs text-teal-700/80">
              선생님이 다듬어 준 글이에요. 내 글과 비교하며 읽어보면 좋아요.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function FeedbackBlock({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "teal" | "amber" | "purple" | "gray";
}) {
  const cls =
    tone === "teal"
      ? "border-teal-100 bg-teal-50/60 text-teal-900"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50/60 text-amber-900"
        : tone === "purple"
          ? "border-area-expression/20 bg-area-expression/5 text-gray-900"
          : "border-gray-200 bg-white text-gray-900";

  const labelCls =
    tone === "teal"
      ? "text-teal-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "purple"
          ? "text-area-expression"
          : "text-gray-500";

  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
        {title}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </div>
  );
}
