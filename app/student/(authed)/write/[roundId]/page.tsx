import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStudentSession } from "@/lib/student-session";
import { prisma } from "@/lib/db";
import { WriteEditor } from "./WriteEditor";

export const dynamic = "force-dynamic";

export default async function WritePage({
  params,
}: {
  params: { roundId: string };
}) {
  const s = (await getStudentSession())!;

  const round = await prisma.assignmentRound.findUnique({
    where: { id: params.roundId },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          description: true,
          writingType: true,
          minChars: true,
          recommendedChars: true,
          isActive: true,
          classId: true,
        },
      },
    },
  });

  if (!round) notFound();
  if (round.assignment.classId !== s.classId) redirect("/student/home");
  if (!round.assignment.isActive || !round.isOpen) {
    return (
      <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl">
        <Link href="/student/home" className="text-sm text-gray-500">
          ← 홈
        </Link>
        <div className="card mt-3">
          <p className="text-sm text-gray-700">이 글쓰기는 더 이상 받지 않아요.</p>
        </div>
      </main>
    );
  }

  // 기존 제출(임시저장 또는 제출)이 있나?
  const existing = await prisma.submission.findUnique({
    where: {
      studentId_assignmentRoundId: {
        studentId: s.studentId,
        assignmentRoundId: round.id,
      },
    },
    select: { id: true, text: true, charCount: true, status: true, submittedAt: true },
  });

  // 이미 제출했으면 편집 불가 → 보기 화면으로
  if (existing?.status === "SUBMITTED") {
    return (
      <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl">
        <Link href="/student/home" className="text-sm text-gray-500">
          ← 홈
        </Link>
        <div className="card mt-3 space-y-3">
          <p className="text-sm text-teal-700">✓ 이미 제출했어요.</p>
          <h1 className="text-lg font-bold text-gray-900">
            {round.assignment.title}{" "}
            <span className="text-sm text-gray-500">({round.roundNumber}회차)</span>
          </h1>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{existing.text}</p>
          <p className="text-xs text-gray-500">
            {existing.charCount}자 · 제출일{" "}
            {existing.submittedAt
              ? new Date(existing.submittedAt).toLocaleString("ko-KR")
              : "—"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <WriteEditor
      round={{
        id: round.id,
        roundNumber: round.roundNumber,
        deadline: round.deadline.toISOString(),
      }}
      assignment={round.assignment}
      initial={existing}
    />
  );
}
