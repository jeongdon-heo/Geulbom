import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FeedbackReview } from "./FeedbackReview";

export const dynamic = "force-dynamic";

export default async function FeedbackDetailPage({
  params,
}: {
  params: { id: string }; // submission id
}) {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const submission = await prisma.submission.findUnique({
    where: { id: params.id },
    include: {
      student: { select: { id: true, name: true, number: true } },
      assignmentRound: {
        include: {
          assignment: {
            include: {
              class: { select: { id: true, name: true, teacherId: true } },
              rubricTemplate: true,
            },
          },
        },
      },
      feedback: true,
    },
  });

  if (!submission) notFound();
  if (submission.assignmentRound.assignment.class.teacherId !== teacherId)
    redirect("/dashboard/feedback");
  if (submission.status !== "SUBMITTED") {
    return (
      <main>
        <Link href="/dashboard/feedback" className="text-sm text-gray-500">
          ← 피드백 목록
        </Link>
        <div className="card mt-3">
          <p className="text-sm text-gray-700">
            이 제출물은 아직 제출 완료 상태가 아닙니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <FeedbackReview
      submission={{
        id: submission.id,
        text: submission.text,
        charCount: submission.charCount,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
        student: submission.student,
        assignment: {
          id: submission.assignmentRound.assignment.id,
          title: submission.assignmentRound.assignment.title,
          writingType: submission.assignmentRound.assignment.writingType,
          minChars: submission.assignmentRound.assignment.minChars,
          autoApprove: submission.assignmentRound.assignment.autoApprove,
          aiPromptNote: submission.assignmentRound.assignment.aiPromptNote,
        },
        round: { roundNumber: submission.assignmentRound.roundNumber },
        rubric: {
          name: submission.assignmentRound.assignment.rubricTemplate.name,
          totalScore: submission.assignmentRound.assignment.rubricTemplate.totalScore,
          areas: submission.assignmentRound.assignment.rubricTemplate
            .areas as unknown as { key: string; name: string; maxScore: number }[],
        },
      }}
      feedback={
        submission.feedback
          ? {
              id: submission.feedback.id,
              scores: submission.feedback.scores as Record<string, number>,
              totalScore: submission.feedback.totalScore,
              feedbackStudent: submission.feedback
                .feedbackStudent as unknown as {
                praise: string;
                suggestion: string;
                encouragement: string;
              },
              teacherEditedStudent: submission.feedback
                .teacherEditedStudent as unknown as {
                praise: string;
                suggestion: string;
                encouragement: string;
              } | null,
              feedbackTeacher: submission.feedback.feedbackTeacher as unknown as {
                areaAnalysis: Record<string, { score: number; comment: string }>;
                grammarErrors: {
                  original: string;
                  corrected: string;
                  type: string;
                  explanation: string;
                }[];
                repetitions: { word: string; count: number; alternatives: string[] }[];
                overall: string;
                comparisonWithPrevious: string | null;
                teachingDirection: string;
              },
              teacherComment: submission.feedback.teacherComment,
              approvalStatus: submission.feedback.approvalStatus,
              approvedAt: submission.feedback.approvedAt?.toISOString() ?? null,
              aiProvider: submission.feedback.aiProvider,
            }
          : null
      }
    />
  );
}
