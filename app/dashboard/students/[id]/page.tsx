import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Lock,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  analyzeGrowth,
  evaluateBadges,
  type FeedbackPoint,
  type RubricArea,
} from "@/lib/growth";
import { StudentDetailCharts } from "./StudentDetailCharts";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      class: { select: { id: true, name: true, year: true, teacherId: true } },
    },
  });
  if (!student) notFound();
  if (student.class.teacherId !== teacherId) redirect("/dashboard/students");

  // 학생의 모든 제출물 (피드백 + 회차 정보)
  const submissions = await prisma.submission.findMany({
    where: { studentId: student.id, status: "SUBMITTED" },
    orderBy: [
      { assignmentRound: { assignment: { createdAt: "asc" } } },
      { assignmentRound: { roundNumber: "asc" } },
    ],
    select: {
      id: true,
      text: true,
      charCount: true,
      submittedAt: true,
      inputMethod: true,
      assignmentRound: {
        select: {
          roundNumber: true,
          deadline: true,
          assignment: {
            select: {
              id: true,
              title: true,
              writingType: true,
              rubricTemplate: {
                select: { id: true, totalScore: true, areas: true },
              },
            },
          },
        },
      },
      feedback: {
        select: {
          id: true,
          totalScore: true,
          scores: true,
          approvalStatus: true,
          approvedAt: true,
          createdAt: true,
        },
      },
    },
  });

  // 피드백이 있는 것만 분석 대상
  const feedbackPoints: FeedbackPoint[] = submissions
    .filter((s) => s.feedback)
    .map((s) => ({
      roundNumber: s.assignmentRound.roundNumber,
      assignmentTitle: s.assignmentRound.assignment.title,
      date: (s.feedback!.approvedAt ?? s.feedback!.createdAt).toISOString(),
      scores: s.feedback!.scores as unknown as Record<string, number>,
      totalScore: s.feedback!.totalScore,
      approved: s.feedback!.approvalStatus === "APPROVED",
    }));

  const latestRubricAreas: RubricArea[] =
    (submissions[submissions.length - 1]?.assignmentRound.assignment.rubricTemplate
      ?.areas as unknown as RubricArea[]) ?? [];

  const analysis = analyzeGrowth(feedbackPoints, latestRubricAreas);
  const badges = evaluateBadges(feedbackPoints, latestRubricAreas);

  return (
    <>
      <Link
        href={`/dashboard/students?classId=${student.classId}`}
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        학생 목록
      </Link>

      {/* 헤더 */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">
            {student.class.year} {student.class.name} · {student.number}번
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
        </div>
        <Link
          href={`/dashboard/growth?classId=${student.classId}&studentId=${student.id}`}
          className="btn-secondary text-sm"
        >
          <TrendingUp className="h-4 w-4" />
          성장 분석에서 보기
        </Link>
      </div>

      {/* 요약 통계 */}
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <SummaryBox label="제출한 글" value={`${submissions.length}편`} />
        <SummaryBox
          label="분석 완료"
          value={`${feedbackPoints.length}편`}
        />
        <SummaryBox
          label="최근 평균"
          value={
            analysis.recentAverageTotal !== null
              ? `${analysis.recentAverageTotal}점`
              : "—"
          }
        />
        <SummaryBox
          label="첫→최근 변화"
          value={
            analysis.totalDelta !== null
              ? `${analysis.totalDelta >= 0 ? "+" : ""}${analysis.totalDelta}점`
              : "—"
          }
          tone={analysis.totalDelta && analysis.totalDelta < 0 ? "warm" : "teal"}
        />
      </section>

      {/* 인사이트 */}
      {analysis.mostGrown && (
        <p className="mb-5 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-700">
          <TrendingUp className="mr-1 inline h-4 w-4" />
          가장 성장한 영역은 <strong>{analysis.mostGrown.areaName}</strong> (
          {analysis.mostGrown.delta >= 0 ? "+" : ""}
          {analysis.mostGrown.delta}점). 평균 {analysis.mostGrown.average}점.
          {analysis.mostStagnant &&
            analysis.mostStagnant.areaKey !== analysis.mostGrown.areaKey && (
              <>
                {" · "}
                지도 포커스: <strong>{analysis.mostStagnant.areaName}</strong> (
                {analysis.mostStagnant.delta >= 0 ? "+" : ""}
                {analysis.mostStagnant.delta}점)
              </>
            )}
        </p>
      )}

      {/* 차트 */}
      {analysis.count > 0 && (
        <section className="mb-6">
          <StudentDetailCharts
            analysis={analysis}
            rubricAreas={latestRubricAreas}
          />
        </section>
      )}

      {/* 뱃지 */}
      {feedbackPoints.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">뱃지 진척도</h2>
          <div className="grid gap-2 md:grid-cols-4">
            {badges.map((b) => (
              <div
                key={b.key}
                className={`rounded-lg border p-3 text-sm ${
                  b.achieved
                    ? "border-teal-200 bg-teal-50 text-teal-700"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {b.achieved ? (
                    <Award className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {b.label}
                </div>
                <p className="mt-0.5 text-xs opacity-80">{b.description}</p>
                {b.progressLabel && (
                  <p className="mt-1 text-xs font-medium text-gray-700">
                    {b.progressLabel}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 타임라인 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">제출 타임라인</h2>
        {submissions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500">
            아직 제출한 글이 없어요.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-gray-100 pl-5">
            {submissions
              .slice()
              .reverse() // 최신부터
              .map((s) => (
                <li key={s.id} className="relative">
                  <span className="absolute -left-[26px] top-3 h-3 w-3 rounded-full border-2 border-white bg-teal" />
                  <Link
                    href={
                      s.feedback
                        ? `/dashboard/feedback/${s.id}`
                        : `/dashboard/feedback?filter=needs_analysis`
                    }
                    className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-teal-500 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <StatusBadge feedback={s.feedback} />
                          <span className="text-xs text-gray-500">
                            {s.assignmentRound.assignment.writingType} ·{" "}
                            {s.assignmentRound.roundNumber}회차 ·{" "}
                            {InputMethodLabel(s.inputMethod)}
                          </span>
                        </div>
                        <h3 className="truncate font-semibold text-gray-900">
                          {s.assignmentRound.assignment.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                          {s.text.slice(0, 120)}
                          {s.text.length > 120 ? "…" : ""}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          {s.charCount}자 ·{" "}
                          {s.submittedAt &&
                            new Date(s.submittedAt).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {s.feedback ? (
                          <p className="text-xl font-bold text-gray-900">
                            {s.feedback.totalScore}
                            <span className="text-xs font-normal text-gray-500">
                              {" "}
                              /{" "}
                              {s.assignmentRound.assignment.rubricTemplate
                                ?.totalScore ?? 100}
                            </span>
                          </p>
                        ) : (
                          <ClipboardList className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
          </ol>
        )}
      </section>
    </>
  );
}

function SummaryBox({
  label,
  value,
  tone = "teal",
}: {
  label: string;
  value: string;
  tone?: "teal" | "warm";
}) {
  const cls =
    tone === "warm"
      ? "border-area-grammar/20 bg-area-grammar/5"
      : "border-gray-200 bg-white";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function InputMethodLabel(m: string) {
  switch (m) {
    case "TYPED":
      return "직접 입력";
    case "STUDENT_OCR":
      return "학생 OCR";
    case "TEACHER_OCR":
      return "교사 OCR";
    default:
      return m;
  }
}

function StatusBadge({
  feedback,
}: {
  feedback: { approvalStatus: string } | null;
}) {
  if (!feedback)
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Sparkles className="h-3 w-3" />
        AI 분석 대기
      </span>
    );
  if (feedback.approvalStatus === "PENDING")
    return (
      <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
        <Clock className="h-3 w-3" />
        검토 대기
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      <CheckCircle2 className="h-3 w-3" />
      승인됨
    </span>
  );
}
