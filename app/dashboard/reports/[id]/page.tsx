import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ChevronLeft,
  Sparkles,
  Trophy,
  Quote,
  Compass,
  Lightbulb,
  HeartHandshake,
  TrendingUp,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ReportActions } from "./ReportActions";

export const dynamic = "force-dynamic";

interface TeacherReport {
  summary: string;
  areaGrowth: Record<
    string,
    { name: string; startScore: number; endScore: number; comment: string }
  >;
  milestones: { roundNumber: number; title: string; description: string }[];
  bestSentences: { roundNumber: number; sentence: string }[];
  nextYearSuggestions: string[];
}

interface StudentReport {
  growthStory: string;
  bestMoments: string;
  improvements: { area: string; before: string; after: string }[];
  nextYearMission: string[];
  teacherMessage: string;
}

export default async function ReportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const report = await prisma.yearendReport.findUnique({
    where: { id: params.id },
    include: {
      student: { select: { id: true, name: true, number: true } },
      class: {
        select: { id: true, name: true, year: true, teacherId: true },
      },
    },
  });
  if (!report) notFound();
  if (report.class.teacherId !== teacherId) redirect("/dashboard/reports");

  const teacherR = report.reportTeacher as unknown as TeacherReport;
  const studentR = report.reportStudent as unknown as StudentReport;
  const areaEntries = Object.entries(teacherR.areaGrowth);

  return (
    <article className="report-page">
      <Link
        href={`/dashboard/reports?classId=${report.class.id}`}
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-900 no-print"
      >
        <ChevronLeft className="h-4 w-4" />
        보고서 목록
      </Link>

      {/* 헤더 */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <p className="text-sm text-gray-500">
            {report.class.year} {report.class.name} · {report.student.number}번
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            {report.student.name} 학생 학년말 보고서
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            생성일:{" "}
            {new Date(report.generatedAt).toLocaleString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </header>

      <ReportActions reportId={report.id} studentId={report.student.id} />

      {/* ===================== 교사 / 학부모용 ===================== */}
      <section className="mb-8">
        <SectionTitle icon={<Sparkles className="h-5 w-5" />}>
          교사·학부모용 종합 분석
        </SectionTitle>

        <div className="card mb-4 whitespace-pre-wrap leading-relaxed text-gray-800">
          {teacherR.summary}
        </div>

        {/* 영역별 성장 */}
        {areaEntries.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <TrendingUp className="h-4 w-4" />
              영역별 1년 변화
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {areaEntries.map(([key, a]) => {
                const diff = a.endScore - a.startScore;
                const sign = diff >= 0 ? "+" : "";
                const tone =
                  diff > 0
                    ? "border-teal-200 bg-teal-50"
                    : diff < 0
                      ? "border-rose-200 bg-rose-50"
                      : "border-gray-200 bg-white";
                return (
                  <div key={key} className={`rounded-xl border p-4 ${tone}`}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <h4 className="font-semibold text-gray-900">{a.name}</h4>
                      <p className="text-sm">
                        <span className="text-gray-500">{a.startScore}</span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="font-bold text-gray-900">
                          {a.endScore}
                        </span>
                        <span
                          className={`ml-2 text-xs font-semibold ${
                            diff > 0
                              ? "text-teal-700"
                              : diff < 0
                                ? "text-rose-700"
                                : "text-gray-500"
                          }`}
                        >
                          ({sign}
                          {diff})
                        </span>
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-700">
                      {a.comment}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 마일스톤 */}
        {teacherR.milestones.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Trophy className="h-4 w-4" />
              인상 깊었던 글
            </h3>
            <ol className="space-y-2">
              {teacherR.milestones.map((m, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    <span className="mr-2 inline-flex h-5 min-w-[24px] items-center justify-center rounded bg-teal-50 px-1.5 text-xs font-medium text-teal-700">
                      {m.roundNumber}회
                    </span>
                    {m.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{m.description}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 빛났던 문장 */}
        {teacherR.bestSentences.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Quote className="h-4 w-4" />
              빛났던 문장들
            </h3>
            <ul className="space-y-2">
              {teacherR.bestSentences.map((b, i) => (
                <li
                  key={i}
                  className="rounded-lg border-l-4 border-teal-400 bg-teal-50/50 px-4 py-2"
                >
                  <p className="text-sm text-gray-800">“{b.sentence}”</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {b.roundNumber}회차에서
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 다음 학년 제안 */}
        {teacherR.nextYearSuggestions.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Compass className="h-4 w-4" />
              다음 학년 학습 제안
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {teacherR.nextYearSuggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ===================== 학생용 ===================== */}
      <section>
        <SectionTitle icon={<HeartHandshake className="h-5 w-5" />}>
          {report.student.name} 학생에게 보내는 성장 이야기
        </SectionTitle>

        <div className="card mb-4 whitespace-pre-wrap leading-relaxed text-gray-800">
          {studentR.growthStory}
        </div>

        {/* 빛났던 순간 */}
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <Trophy className="h-4 w-4" />
            가장 빛났던 순간
          </h3>
          <p className="text-sm leading-relaxed text-gray-800">
            {studentR.bestMoments}
          </p>
        </div>

        {/* 변화 (before → after) */}
        {studentR.improvements.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <TrendingUp className="h-4 w-4" />
              이만큼 달라졌어요
            </h3>
            <div className="space-y-2">
              {studentR.improvements.map((imp, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-xl border border-gray-200 bg-white p-3 md:grid-cols-[120px_1fr_1fr]"
                >
                  <p className="font-semibold text-teal-700">{imp.area}</p>
                  <div className="text-sm">
                    <p className="text-xs text-gray-500">처음에는</p>
                    <p className="text-gray-700">{imp.before}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-teal-700">지금은</p>
                    <p className="text-gray-900">{imp.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 다음 학년 미션 */}
        {studentR.nextYearMission.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Lightbulb className="h-4 w-4" />
              다음 학년 미션
            </h3>
            <ol className="space-y-1.5">
              {studentR.nextYearMission.map((m, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-teal-50/60 px-3 py-2 text-sm text-gray-800"
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span>{m}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 선생님 메시지 */}
        <div className="rounded-xl border-2 border-teal-200 bg-white p-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-teal-700">
            <HeartHandshake className="h-4 w-4" />
            선생님 마음
          </h3>
          <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
            {studentR.teacherMessage}
          </p>
        </div>
      </section>
    </article>
  );
}

function SectionTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 border-l-4 border-teal pl-3 text-lg font-bold text-gray-900">
      <span className="text-teal">{icon}</span>
      {children}
    </h2>
  );
}
