import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ClipboardList,
  Users,
  CheckSquare,
  AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  // layout이 이미 인증을 보장
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  // 통계 4종을 병렬로
  const [classCount, studentCount, activeAssignments, pendingFeedback] =
    await Promise.all([
      prisma.class.count({ where: { teacherId } }),
      prisma.student.count({ where: { class: { teacherId } } }),
      prisma.assignment.count({
        where: { class: { teacherId }, isActive: true },
      }),
      prisma.feedback.count({
        where: {
          approvalStatus: "PENDING",
          submission: { assignmentRound: { assignment: { class: { teacherId } } } },
        },
      }),
    ]);

  const hasClass = classCount > 0;

  return (
    <>
      <div className="mb-8">
        <p className="text-sm text-gray-500">환영합니다 👋</p>
        <h1 className="text-2xl font-bold text-gray-900">
          {session.user.name} 선생님
        </h1>
      </div>

      {/* 통계 카드 */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="학급"
          value={classCount}
          icon={<Users className="h-5 w-5 text-area-structure" />}
        />
        <StatCard
          label="학생"
          value={studentCount}
          icon={<Users className="h-5 w-5 text-teal" />}
        />
        <StatCard
          label="진행중 과제"
          value={activeAssignments}
          icon={<ClipboardList className="h-5 w-5 text-area-expression" />}
        />
        <StatCard
          label="검토 대기 피드백"
          value={pendingFeedback}
          icon={<CheckSquare className="h-5 w-5 text-area-grammar" />}
          highlight={pendingFeedback > 0}
        />
      </div>

      {/* 학급 없으면 온보딩 */}
      {!hasClass ? (
        <div className="card flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-semibold text-gray-900">먼저 학급을 만들어주세요</h2>
            <p className="mt-1 text-sm text-gray-600">
              설정 화면에서 학급을 생성하면 학생을 추가하고 과제를 출제할 수 있어요.
            </p>
            <Link
              href="/dashboard/settings"
              className="btn-primary mt-4 text-sm"
            >
              학급 만들기
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <QuickAction
            href="/dashboard/assignments/new"
            title="새 과제 출제하기"
            desc="정기/비정기 과제를 만들고 회차를 설정하세요."
          />
          <QuickAction
            href="/dashboard/feedback"
            title="피드백 검토하기"
            desc={
              pendingFeedback > 0
                ? `검토 대기 ${pendingFeedback}건이 있어요.`
                : "검토 대기 중인 피드백이 없습니다."
            }
          />
        </div>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${
        highlight ? "border-area-grammar/30 bg-area-grammar/5" : "border-gray-200 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="card transition hover:border-teal-500 hover:shadow-md"
    >
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{desc}</p>
    </Link>
  );
}
