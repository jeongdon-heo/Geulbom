import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BehaviorManager, type BehaviorRow } from "./BehaviorManager";

export const dynamic = "force-dynamic";

interface DraftContent {
  draft: string;
  keywords: string[];
}

export default async function BehaviorPage({
  searchParams,
}: {
  searchParams: { classId?: string; assignmentId?: string };
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

  const selectedClassId =
    searchParams.classId && classes.some((c) => c.id === searchParams.classId)
      ? searchParams.classId
      : classes[0].id;

  // 선택 학급의 학기말 글쓰기 과제 목록
  const assignments = await prisma.assignment.findMany({
    where: { classId: selectedClassId, type: "SEMESTER_END" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <>
      <Header />

      {/* 학급 선택 탭 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {classes.map((c) => {
          const active = c.id === selectedClassId;
          return (
            <Link
              key={c.id}
              href={`/dashboard/behavior?classId=${c.id}`}
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

      {assignments.length === 0 ? (
        <div className="card">
          <p className="text-sm text-gray-700">
            이 학급에 <span className="font-medium">학기말 글쓰기</span> 과제가 아직
            없습니다.{" "}
            <Link
              href="/dashboard/assignments/new"
              className="font-medium text-teal hover:underline"
            >
              과제 관리에서 새 과제
            </Link>
            를 만들 때 유형을 “학기말 글쓰기”로 선택하세요.
          </p>
        </div>
      ) : (
        await renderManager(selectedClassId, assignments, searchParams.assignmentId)
      )}
    </>
  );
}

async function renderManager(
  classId: string,
  assignments: { id: string; title: string }[],
  requestedAssignmentId?: string
) {
  const selectedAssignmentId =
    requestedAssignmentId && assignments.some((a) => a.id === requestedAssignmentId)
      ? requestedAssignmentId
      : assignments[0].id;

  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      name: true,
      submissions: {
        where: {
          status: "SUBMITTED",
          assignmentRound: { assignmentId: selectedAssignmentId },
        },
        select: { id: true },
      },
      behaviorReports: {
        where: { assignmentId: selectedAssignmentId },
        select: { id: true, content: true, length: true, generatedAt: true },
      },
    },
  });

  const rows: BehaviorRow[] = students.map((s) => {
    const r = s.behaviorReports[0];
    return {
      id: s.id,
      number: s.number,
      name: s.name,
      submitted: s.submissions.length > 0,
      report: r
        ? {
            id: r.id,
            content: r.content as unknown as DraftContent,
            length: r.length,
            generatedAt: r.generatedAt.toISOString(),
          }
        : null,
    };
  });

  return (
    <>
      {/* 과제 선택 탭 */}
      <div className="mb-5 flex flex-wrap gap-2">
        {assignments.map((a) => {
          const active = a.id === selectedAssignmentId;
          return (
            <Link
              key={a.id}
              href={`/dashboard/behavior?classId=${classId}&assignmentId=${a.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-teal bg-teal-50 text-teal-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {a.title}
            </Link>
          );
        })}
      </div>

      <BehaviorManager assignmentId={selectedAssignmentId} students={rows} />
    </>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">행동특성 및 종합의견</h1>
      <p className="mt-1 text-sm text-gray-500">
        학기말 글쓰기 답변을 근거로, 생활기록부 “행동특성 및 종합의견” 초안을 AI가
        학생별로 작성합니다. 초안은 검토·수정용입니다.
      </p>
    </div>
  );
}
