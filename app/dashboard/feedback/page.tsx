import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckCircle2, Clock, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

type Filter = "all" | "pending" | "needs_analysis" | "approved";

export default async function FeedbackListPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;
  const filter: Filter =
    searchParams.filter === "pending"
      ? "pending"
      : searchParams.filter === "needs_analysis"
        ? "needs_analysis"
        : searchParams.filter === "approved"
          ? "approved"
          : "all";

  // 제출 + 피드백 조인 (모두 한 번에 가져와 클라에서 분류 가능)
  const rows = await prisma.submission.findMany({
    where: {
      status: "SUBMITTED",
      assignmentRound: { assignment: { class: { teacherId } } },
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
    select: {
      id: true,
      submittedAt: true,
      charCount: true,
      student: { select: { name: true, number: true } },
      assignmentRound: {
        select: {
          roundNumber: true,
          assignment: {
            select: {
              title: true,
              writingType: true,
              rubricTemplate: { select: { totalScore: true } },
            },
          },
        },
      },
      feedback: {
        select: {
          id: true,
          totalScore: true,
          approvalStatus: true,
          approvedAt: true,
          createdAt: true,
        },
      },
    },
  });

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "needs_analysis") return !r.feedback;
    if (filter === "pending") return r.feedback?.approvalStatus === "PENDING";
    if (filter === "approved") return r.feedback?.approvalStatus === "APPROVED";
    return true;
  });

  const counts = {
    all: rows.length,
    needs_analysis: rows.filter((r) => !r.feedback).length,
    pending: rows.filter((r) => r.feedback?.approvalStatus === "PENDING").length,
    approved: rows.filter((r) => r.feedback?.approvalStatus === "APPROVED").length,
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">피드백 검토</h1>
        <p className="mt-1 text-sm text-gray-500">
          학생 제출물의 AI 분석 결과를 검토하고 승인합니다.
        </p>
      </div>

      {/* 필터 탭 */}
      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip current={filter} value="all" label={`전체 ${counts.all}`} />
        <FilterChip
          current={filter}
          value="needs_analysis"
          label={`AI 분석 대기 ${counts.needs_analysis}`}
          tone="amber"
        />
        <FilterChip
          current={filter}
          value="pending"
          label={`교사 검토 대기 ${counts.pending}`}
          tone="teal"
        />
        <FilterChip
          current={filter}
          value="approved"
          label={`승인 완료 ${counts.approved}`}
          tone="gray"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500">
          조건에 맞는 항목이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/feedback/${r.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-teal-500 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge feedback={r.feedback} />
                      <span className="text-xs text-gray-500">
                        {r.assignmentRound.assignment.writingType} ·{" "}
                        {r.assignmentRound.roundNumber}회차
                      </span>
                    </div>
                    <h3 className="truncate font-semibold text-gray-900">
                      {r.assignmentRound.assignment.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-700">
                      {r.student.number}번 {r.student.name}
                      <span className="ml-2 text-xs text-gray-500">
                        · {r.charCount}자
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {r.feedback ? (
                      <p className="text-lg font-bold text-gray-900">
                        {r.feedback.totalScore}
                        <span className="text-xs font-normal text-gray-500">
                          {" "}
                          / {r.assignmentRound.assignment.rubricTemplate.totalScore}
                        </span>
                      </p>
                    ) : (
                      <span className="text-xs text-gray-400">미분석</span>
                    )}
                    <p className="mt-0.5 text-xs text-gray-500">
                      {r.submittedAt &&
                        new Date(r.submittedAt).toLocaleDateString("ko-KR", {
                          month: "short",
                          day: "numeric",
                        })}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FilterChip({
  current,
  value,
  label,
  tone = "neutral",
}: {
  current: Filter;
  value: Filter;
  label: string;
  tone?: "neutral" | "amber" | "teal" | "gray";
}) {
  const active = current === value;
  const base = "rounded-full border px-3 py-1.5 text-xs font-medium transition";
  const cls = active
    ? tone === "amber"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : tone === "teal"
        ? "border-teal-500 bg-teal-50 text-teal-700"
        : "border-gray-700 bg-gray-900 text-white"
    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50";
  return (
    <Link href={`/dashboard/feedback?filter=${value}`} className={`${base} ${cls}`}>
      {label}
    </Link>
  );
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
