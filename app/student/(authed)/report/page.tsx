import Link from "next/link";
import {
  ChevronLeft,
  HeartHandshake,
  Lightbulb,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { getStudentSession } from "@/lib/student-session";
import { prisma } from "@/lib/db";
import { ReportPrintButton } from "./ReportPrintButton";

export const dynamic = "force-dynamic";

interface StudentReport {
  growthStory: string;
  bestMoments: string;
  improvements: { area: string; before: string; after: string }[];
  nextYearMission: string[];
  teacherMessage: string;
}

export default async function StudentReportPage() {
  // layout이 인증 보장
  const s = (await getStudentSession())!;

  // 학생의 가장 최근 학년말 보고서
  const report = await prisma.yearendReport.findFirst({
    where: { studentId: s.studentId },
    orderBy: { year: "desc" },
    include: {
      class: { select: { name: true, year: true } },
    },
  });

  if (!report) {
    return (
      <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl">
        <Link
          href="/student/home"
          className="mb-4 inline-flex items-center text-sm text-gray-500"
        >
          <ChevronLeft className="h-4 w-4" />홈
        </Link>
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-semibold text-gray-700">
            아직 학년말 보고서가 없어요
          </p>
          <p className="mt-1 text-sm text-gray-500">
            1년 동안 글을 더 써보면 선생님이 만들어 주실 거예요!
          </p>
        </div>
      </main>
    );
  }

  const studentR = report.reportStudent as unknown as StudentReport;

  return (
    <article className="report-page mx-auto max-w-md px-5 pt-6 md:max-w-4xl">
      <div className="mb-3 flex items-center justify-between no-print">
        <Link
          href="/student/home"
          className="inline-flex items-center text-sm text-gray-500"
        >
          <ChevronLeft className="h-4 w-4" />홈
        </Link>
        <ReportPrintButton />
      </div>

      {/* 헤더 */}
      <header className="mb-5 border-b border-gray-200 pb-3">
        <p className="text-sm text-gray-500">
          {report.class.year} {report.class.name}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          {s.name} 학생의 1년 성장 이야기
        </h1>
      </header>

      {/* 성장 스토리 */}
      <section className="mb-4 rounded-2xl border border-teal-100 bg-white p-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-teal-700">
          <TrendingUp className="h-4 w-4" />
          나의 1년 이야기
        </h2>
        <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
          {studentR.growthStory}
        </p>
      </section>

      {/* 빛났던 순간 */}
      <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
          <Trophy className="h-4 w-4" />
          가장 빛났던 순간
        </h2>
        <p className="leading-relaxed text-gray-800">{studentR.bestMoments}</p>
      </section>

      {/* 이만큼 달라졌어요 */}
      {studentR.improvements.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <TrendingUp className="h-4 w-4" />
            이만큼 달라졌어요
          </h2>
          <div className="space-y-2">
            {studentR.improvements.map((imp, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-3"
              >
                <p className="mb-2 text-xs font-semibold text-teal-700">
                  {imp.area}
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-[10px] text-gray-500">처음에는</p>
                    <p className="text-gray-700">{imp.before}</p>
                  </div>
                  <div className="rounded-lg bg-teal-50 p-2">
                    <p className="text-[10px] text-teal-700">지금은!</p>
                    <p className="text-gray-900">{imp.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 다음 학년 미션 */}
      {studentR.nextYearMission.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <Lightbulb className="h-4 w-4" />
            다음 학년 미션
          </h2>
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
        </section>
      )}

      {/* 선생님 메시지 */}
      <section className="mb-8 rounded-2xl border-2 border-teal-200 bg-white p-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-teal-700">
          <HeartHandshake className="h-4 w-4" />
          선생님 마음
        </h2>
        <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
          {studentR.teacherMessage}
        </p>
      </section>

      <p className="pb-4 text-center text-[10px] text-gray-400 no-print">
        생성일: {new Date(report.generatedAt).toLocaleDateString("ko-KR")}
      </p>
    </article>
  );
}
