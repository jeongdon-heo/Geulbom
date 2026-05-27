import Link from "next/link";
import { getStudentSession } from "@/lib/student-session";
import { prisma } from "@/lib/db";
import { MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentFeedbackListPage() {
  const s = (await getStudentSession())!;

  // 학생에게는 승인된(APPROVED) 피드백만 보임
  const feedbacks = await prisma.feedback.findMany({
    where: {
      approvalStatus: "APPROVED",
      submission: { studentId: s.studentId },
    },
    orderBy: { approvedAt: "desc" },
    include: {
      submission: {
        select: {
          id: true,
          assignmentRound: {
            select: {
              roundNumber: true,
              assignment: { select: { title: true, writingType: true } },
            },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">내 피드백</h1>
      <p className="mb-5 text-sm text-gray-500">선생님이 확인한 피드백들이에요.</p>

      {feedbacks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">아직 받은 피드백이 없어요.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {feedbacks.map((f) => (
            <li key={f.id}>
              <Link
                href={`/student/feedback/${f.submission.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-teal-500 hover:shadow-sm"
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>{f.submission.assignmentRound.assignment.writingType}</span>
                  <span>·</span>
                  <span>{f.submission.assignmentRound.roundNumber}회차</span>
                </div>
                <p className="font-semibold text-gray-900">
                  {f.submission.assignmentRound.assignment.title}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {f.approvedAt &&
                    new Date(f.approvedAt).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
