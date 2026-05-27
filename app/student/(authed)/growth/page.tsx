import Link from "next/link";
import { Sprout } from "lucide-react";
import { getStudentSession } from "@/lib/student-session";
import { prisma } from "@/lib/db";
import {
  analyzeGrowth,
  evaluateBadges,
  type FeedbackPoint,
  type RubricArea,
} from "@/lib/growth";
import { StudentGrowthView } from "./StudentGrowthView";

export const dynamic = "force-dynamic";

export default async function StudentGrowthPage() {
  const s = (await getStudentSession())!;

  const feedbacks = await prisma.feedback.findMany({
    where: {
      approvalStatus: "APPROVED",
      submission: { studentId: s.studentId },
    },
    orderBy: { approvedAt: "asc" },
    include: {
      submission: {
        select: {
          id: true,
          text: true,
          assignmentRound: {
            select: {
              roundNumber: true,
              deadline: true,
              assignment: {
                select: {
                  id: true,
                  title: true,
                  writingType: true,
                  rubricTemplate: {
                    select: { id: true, areas: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (feedbacks.length === 0) {
    return (
      <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl pb-20">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">나의 성장</h1>
        <p className="mb-6 text-sm text-gray-500">곧 만나요!</p>
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
          <Sprout className="mx-auto mb-3 h-10 w-10 text-teal-200" />
          <p className="text-sm text-gray-500">
            아직 공개된 피드백이 없어요. 글을 쓰면 여기에 성장 기록이 쌓여요.
          </p>
          <Link href="/student/home" className="btn-primary mt-4 text-sm">
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  // 가장 최근 피드백의 루브릭을 기본 영역 정의로 사용
  const latest = feedbacks[feedbacks.length - 1];
  const rubricAreas =
    (latest.submission.assignmentRound.assignment.rubricTemplate
      ?.areas as unknown as RubricArea[]) ?? [];

  const points: FeedbackPoint[] = feedbacks.map((f) => ({
    roundNumber: f.submission.assignmentRound.roundNumber,
    assignmentTitle: f.submission.assignmentRound.assignment.title,
    date: (f.approvedAt ?? f.createdAt).toISOString(),
    scores: f.scores as unknown as Record<string, number>,
    totalScore: f.totalScore,
    approved: true,
  }));

  const analysis = analyzeGrowth(points, rubricAreas);
  const badges = evaluateBadges(points, rubricAreas);

  const writings = feedbacks.map((f) => ({
    submissionId: f.submission.id,
    feedbackId: f.id,
    roundNumber: f.submission.assignmentRound.roundNumber,
    title: f.submission.assignmentRound.assignment.title,
    writingType: f.submission.assignmentRound.assignment.writingType,
    textPreview: f.submission.text.slice(0, 80),
    totalScore: f.totalScore,
    approvedAt: (f.approvedAt ?? f.createdAt).toISOString(),
  }));

  return (
    <StudentGrowthView
      studentName={s.name}
      rubricAreas={rubricAreas}
      analysis={analysis}
      badges={badges}
      writings={writings}
    />
  );
}
