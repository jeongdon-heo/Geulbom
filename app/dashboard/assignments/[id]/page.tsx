import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Calendar, Layers, Users } from "lucide-react";
import { AssignmentActions } from "./AssignmentActions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { REGULAR: "정기", IRREGULAR: "비정기" };
const FREQ_LABEL: Record<string, string> = {
  DAILY: "매일",
  WEEKLY: "주간",
  BIWEEKLY: "격주",
  MONTHLY: "월간",
};

export default async function AssignmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const a = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: {
      class: { select: { id: true, name: true, year: true, teacherId: true } },
      rubricTemplate: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { _count: { select: { submissions: true } } },
      },
    },
  });

  if (!a) notFound();
  if (a.class.teacherId !== teacherId) redirect("/dashboard/assignments");

  const studentCount = await prisma.student.count({ where: { classId: a.classId } });

  return (
    <>
      <Link
        href="/dashboard/assignments"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← 과제 목록
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                a.type === "REGULAR"
                  ? "bg-area-structure/10 text-area-structure"
                  : "bg-area-expression/10 text-area-expression"
              }`}
            >
              {TYPE_LABEL[a.type]}
            </span>
            {a.frequency && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {FREQ_LABEL[a.frequency]}
              </span>
            )}
            {!a.isActive && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                비활성
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{a.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {a.class.name} · {a.writingType} · 루브릭 {a.rubricTemplate.name}
          </p>
        </div>
        <AssignmentActions
          assignmentId={a.id}
          isActive={a.isActive}
          autoApprove={a.autoApprove}
          showScoreToStudent={a.showScoreToStudent}
        />
      </div>

      {/* 요약 */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Summary
          icon={<Users className="h-4 w-4 text-teal" />}
          label="학급 학생"
          value={`${studentCount}명`}
        />
        <Summary
          icon={<Layers className="h-4 w-4 text-area-structure" />}
          label="회차"
          value={`${a.rounds.length}회`}
        />
        <Summary
          icon={<Calendar className="h-4 w-4 text-area-expression" />}
          label={a.type === "REGULAR" ? "기간" : "마감"}
          value={
            a.type === "REGULAR" && a.startDate && a.endDate
              ? `${fmt(a.startDate)} ~ ${fmt(a.endDate)}`
              : a.deadline
                ? fmt(a.deadline)
                : "—"
          }
        />
      </div>

      {a.description && (
        <div className="card mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            안내
          </h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{a.description}</p>
        </div>
      )}

      {a.aiPromptNote && (
        <div className="card mt-4 border-area-expression/30 bg-area-expression/5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-area-expression">
            AI 추가 지시
          </h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{a.aiPromptNote}</p>
        </div>
      )}

      {/* 회차 목록 */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">
        회차 ({a.rounds.length})
      </h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-20 px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">마감</th>
              <th className="px-4 py-2.5">제출</th>
              <th className="w-24 px-4 py-2.5 text-right">상태</th>
            </tr>
          </thead>
          <tbody>
            {a.rounds.map((r) => {
              const past = new Date(r.deadline) < new Date();
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {r.roundNumber}회차
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{fmtDateTime(r.deadline)}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {r._count.submissions} / {studentCount}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        !r.isOpen
                          ? "bg-gray-100 text-gray-500"
                          : past
                            ? "bg-amber-50 text-amber-700"
                            : "bg-teal-50 text-teal-700"
                      }`}
                    >
                      {!r.isOpen ? "닫힘" : past ? "마감됨" : "진행중"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Summary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("ko-KR");
}
function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
