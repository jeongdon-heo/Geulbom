import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AssignmentForm } from "./AssignmentForm";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const [classes, rubrics] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, year: true },
    }),
    prisma.rubricTemplate.findMany({
      where: { OR: [{ teacherId }, { teacher: { role: "admin" } }] },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        totalScore: true,
        teacher: { select: { role: true, name: true } },
      },
    }),
  ]);

  if (classes.length === 0) {
    redirect("/dashboard/settings");
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/assignments"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 과제 목록
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">새 과제 출제</h1>
        <p className="mt-1 text-sm text-gray-500">
          정기 과제는 기간과 빈도를 정하면 회차가 자동으로 생성됩니다.
        </p>
      </div>

      <AssignmentForm classes={classes} rubrics={rubrics} />
    </>
  );
}
