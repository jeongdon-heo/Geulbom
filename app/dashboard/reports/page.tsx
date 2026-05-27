import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ReportsManager } from "./ReportsManager";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { classId?: string };
}) {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const classes = await prisma.class.findMany({
    where: { teacherId },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, year: true },
  });

  if (classes.length === 0) {
    return (
      <>
        <Header />
        <div className="card">
          <p className="text-sm text-gray-700">
            학급이 없습니다. 먼저{" "}
            <Link
              href="/dashboard/settings"
              className="font-medium text-teal hover:underline"
            >
              설정에서 학급
            </Link>
            을 만들어주세요.
          </p>
        </div>
      </>
    );
  }

  const selectedId =
    searchParams.classId && classes.some((c) => c.id === searchParams.classId)
      ? searchParams.classId
      : classes[0].id;
  const selectedClass = classes.find((c) => c.id === selectedId)!;

  // 학생 + 학년 보고서 + 승인된 글 수 일괄 조회
  const students = await prisma.student.findMany({
    where: { classId: selectedId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      name: true,
      yearendReports: {
        where: { year: selectedClass.year },
        select: { id: true, generatedAt: true },
      },
      submissions: {
        where: {
          status: "SUBMITTED",
          feedback: { approvalStatus: "APPROVED" },
        },
        select: { id: true },
      },
    },
  });

  const rows = students.map((s) => ({
    id: s.id,
    number: s.number,
    name: s.name,
    approvedCount: s.submissions.length,
    report: s.yearendReports[0]
      ? {
          id: s.yearendReports[0].id,
          generatedAt: s.yearendReports[0].generatedAt.toISOString(),
        }
      : null,
  }));

  return (
    <>
      <Header />

      {/* 학급 선택 탭 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {classes.map((c) => {
          const active = c.id === selectedId;
          return (
            <Link
              key={c.id}
              href={`/dashboard/reports?classId=${c.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-teal bg-teal-50 text-teal-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c.name}
              <span className="ml-1.5 text-xs text-gray-400">{c.year}</span>
            </Link>
          );
        })}
      </div>

      <ReportsManager
        classId={selectedClass.id}
        year={selectedClass.year}
        students={rows}
      />
    </>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">학년말 보고서</h1>
      <p className="mt-1 text-sm text-gray-500">
        학생별 1년 글쓰기를 AI가 종합 분석하여, 교사/학부모용 보고서와 학생용
        성장 스토리를 생성합니다.
      </p>
    </div>
  );
}
