import Link from "next/link";
import { getStudentSession } from "@/lib/student-session";
import { prisma } from "@/lib/db";
import { StudentLogoutButton } from "../StudentLogoutButton";
import { Calendar, CheckCircle2, MessageCircle, PenSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  // layout이 인증을 보장
  const s = (await getStudentSession())!;

  // ── 데이터 ──
  // 1) 학급의 활성 과제 중 열린 회차들
  const openRounds = await prisma.assignmentRound.findMany({
    where: {
      isOpen: true,
      assignment: { isActive: true, classId: s.classId },
    },
    orderBy: { deadline: "asc" },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          writingType: true,
          minChars: true,
          recommendedChars: true,
        },
      },
      submissions: {
        where: { studentId: s.studentId },
        select: { id: true, status: true, submittedAt: true },
      },
    },
  });

  // 2) 승인되었지만 학생이 아직 안 본 피드백 — "안 봤다" 추적은 아직 없으므로 최근 7일 내 승인된 것
  const recentFeedbacks = await prisma.feedback.findMany({
    where: {
      approvalStatus: "APPROVED",
      submission: { studentId: s.studentId },
      approvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { approvedAt: "desc" },
    take: 5,
    include: {
      submission: {
        select: {
          id: true,
          assignmentRound: {
            select: {
              roundNumber: true,
              assignment: { select: { title: true } },
            },
          },
        },
      },
    },
  });

  const now = Date.now();
  const todoRounds = openRounds.filter(
    (r) => r.submissions.length === 0 || r.submissions[0].status === "DRAFT"
  );
  const doneRounds = openRounds.filter(
    (r) => r.submissions[0]?.status === "SUBMITTED"
  );

  return (
    <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl">
      {/* 상단 인사 */}
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">반가워요</p>
          <h1 className="text-2xl font-bold text-gray-900">{s.name} 학생</h1>
        </div>
        <StudentLogoutButton />
      </header>

      {/* 새 피드백 알림 */}
      {recentFeedbacks.length > 0 && (
        <section className="mb-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700">
            <MessageCircle className="h-4 w-4" />
            새 피드백이 도착했어요!
          </div>
          <ul className="space-y-1.5">
            {recentFeedbacks.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/student/feedback/${f.submission.id}`}
                  className="flex items-center justify-between text-sm text-gray-700 hover:text-teal-700"
                >
                  <span className="truncate">
                    {f.submission.assignmentRound.assignment.title}{" "}
                    <span className="text-xs text-gray-500">
                      ({f.submission.assignmentRound.roundNumber}회차)
                    </span>
                  </span>
                  <span className="text-teal-700">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 해야 할 글쓰기 */}
      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          <PenSquare className="h-4 w-4" />
          해야 할 글쓰기
        </h2>
        {todoRounds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            지금 해야 할 글쓰기가 없어요. 잘하고 있어요!
          </p>
        ) : (
          <ul className="space-y-2">
            {todoRounds.map((r) => {
              const past = new Date(r.deadline).getTime() < now;
              const sub = r.submissions[0];
              return (
                <li key={r.id}>
                  <Link
                    href={`/student/write/${r.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-teal-500 hover:shadow-sm"
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                      <span>{r.assignment.writingType}</span>
                      <span>·</span>
                      <span>{r.roundNumber}회차</span>
                      {sub?.status === "DRAFT" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                          작성 중
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{r.assignment.title}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          past ? "text-area-grammar" : "text-gray-500"
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {past ? "지났어요" : ""} 마감{" "}
                        {new Date(r.deadline).toLocaleDateString("ko-KR", {
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                        })}
                      </span>
                      {r.assignment.minChars && (
                        <span className="text-gray-500">
                          최소 {r.assignment.minChars}자
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 제출 완료 */}
      {doneRounds.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <CheckCircle2 className="h-4 w-4" />
            제출 완료
          </h2>
          <ul className="space-y-2">
            {doneRounds.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700"
              >
                {r.assignment.title}{" "}
                <span className="text-xs text-gray-500">({r.roundNumber}회차)</span>
                <span className="ml-2 text-xs text-teal-700">
                  ✓ 제출{r.submissions[0].submittedAt &&
                    ` (${new Date(r.submissions[0].submittedAt).toLocaleDateString("ko-KR")})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
