import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StudentManager } from "./StudentManager";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { classId?: string };
}) {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const classes = await prisma.class.findMany({
    where: { teacherId },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, year: true, classCode: true },
  });

  if (classes.length === 0) {
    return (
      <>
        <Header />
        <div className="card">
          <p className="text-sm text-gray-700">
            학급이 없습니다. 먼저{" "}
            <Link href="/dashboard/settings" className="font-medium text-teal hover:underline">
              설정에서 학급
            </Link>
            을 만들어주세요.
          </p>
        </div>
      </>
    );
  }

  // 선택된 학급: 쿼리 우선, 없으면 첫 학급
  const selectedId =
    searchParams.classId && classes.some((c) => c.id === searchParams.classId)
      ? searchParams.classId
      : classes[0].id;

  const selectedClass = classes.find((c) => c.id === selectedId)!;
  const students = await prisma.student.findMany({
    where: { classId: selectedId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, name: true, classId: true, createdAt: true },
  });

  return (
    <>
      <Header />

      {/* 학급 선택 탭 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {classes.map((c) => {
          const active = c.id === selectedId;
          return (
            <Link
              key={c.id}
              href={`/dashboard/students?classId=${c.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-teal bg-teal-50 text-teal-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c.name}
              <span className="ml-1.5 text-xs text-gray-400">{c.year}</span>
            </Link>
          );
        })}
      </div>

      <StudentManager
        cls={selectedClass}
        initialStudents={students.map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">학생 포트폴리오</h1>
      <p className="mt-1 text-sm text-gray-500">
        학급별 학생 명단을 관리하고, 학생을 추가/수정합니다.
      </p>
    </div>
  );
}
