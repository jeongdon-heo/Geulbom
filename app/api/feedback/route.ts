import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireTeacher } from "@/lib/session";

// ============================================================
// GET /api/feedback?status=PENDING|APPROVED
// 교사 본인이 담당한 학급의 피드백 목록.
// ============================================================

export async function GET(req: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return fail(auth.message, auth.status);

  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam === "APPROVED" ? "APPROVED" : statusParam === "PENDING" ? "PENDING" : undefined;

  const feedbacks = await prisma.feedback.findMany({
    where: {
      ...(status ? { approvalStatus: status } : {}),
      submission: {
        assignmentRound: { assignment: { class: { teacherId: auth.teacherId } } },
      },
    },
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      totalScore: true,
      approvalStatus: true,
      approvedAt: true,
      createdAt: true,
      aiProvider: true,
      submission: {
        select: {
          id: true,
          charCount: true,
          submittedAt: true,
          student: { select: { id: true, name: true, number: true } },
          assignmentRound: {
            select: {
              roundNumber: true,
              assignment: {
                select: {
                  id: true,
                  title: true,
                  writingType: true,
                  rubricTemplate: { select: { totalScore: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return ok(feedbacks);
}
