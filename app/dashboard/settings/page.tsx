import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ClassManager } from "./ClassManager";
import { AISettings } from "./AISettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const classes = await prisma.class.findMany({
    where: { teacherId },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { students: true } } },
  });

  // JSON 직렬화 (Date → string)
  const initial = classes.map((c) => ({
    id: c.id,
    name: c.name,
    year: c.year,
    classCode: c.classCode,
    studentCount: c._count.students,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          학급을 만들고 관리하세요. AI 키는 브라우저에만 저장됩니다.
        </p>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            학급
          </h2>
          <ClassManager initialClasses={initial} />

          {initial.length > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              학생 등록은{" "}
              <Link
                href="/dashboard/students"
                className="font-medium text-teal hover:underline"
              >
                학생 포트폴리오 페이지
              </Link>
              에서 합니다.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            AI 제공자 / API 키
          </h2>
          <AISettings />
        </section>
      </div>
    </>
  );
}
