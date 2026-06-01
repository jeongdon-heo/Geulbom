import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Plus, Calendar, FileText, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  REGULAR: "정기",
  IRREGULAR: "비정기",
};

const FREQ_LABEL: Record<string, string> = {
  DAILY: "매일",
  WEEKLY: "주간",
  BIWEEKLY: "격주",
  MONTHLY: "월간",
};

export default async function AssignmentsPage() {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const [classCount, assignments] = await Promise.all([
    prisma.class.count({ where: { teacherId } }),
    prisma.assignment.findMany({
      where: { class: { teacherId } },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        class: { select: { id: true, name: true, year: true } },
        rubricTemplate: { select: { name: true } },
        _count: { select: { rounds: true } },
      },
    }),
  ]);

  if (classCount === 0) {
    return (
      <>
        <Header />
        <div className="card">
          <p className="text-sm text-gray-700">
            먼저{" "}
            <Link href="/dashboard/settings" className="font-medium text-teal hover:underline">
              학급을 만들고
            </Link>{" "}
            학생을 등록한 뒤 과제를 출제할 수 있어요.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            아직 출제한 과제가 없습니다. 첫 과제를 만들어보세요.
          </p>
          <Link href="/dashboard/assignments/new" className="btn-primary mt-4 inline-flex">
            <Plus className="h-4 w-4" />
            새 과제
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {assignments.map((a) => {
            const typeBadge =
              a.type === "REGULAR"
                ? "bg-area-structure/10 text-area-structure"
                : "bg-area-expression/10 text-area-expression";
            return (
              <li key={a.id}>
                <Link
                  href={`/dashboard/assignments/${a.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-teal-500 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeBadge}`}>
                          {TYPE_LABEL[a.type]}
                        </span>
                        {a.type === "REGULAR" && a.frequency && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {FREQ_LABEL[a.frequency]}
                          </span>
                        )}
                        {!a.isActive && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            비활성
                          </span>
                        )}
                      </div>
                      <h3 className="truncate font-semibold text-gray-900">{a.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>{a.class.name}</span>
                        <span>·</span>
                        <span>
                          {a.rubricTemplate ? `루브릭: ${a.rubricTemplate.name}` : "학기말 글쓰기"}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          회차 {a._count.rounds}
                        </span>
                      </div>
                    </div>
                    {a.deadline && (
                      <div className="text-right text-xs text-gray-500">
                        <Calendar className="ml-auto h-3.5 w-3.5" />
                        마감 {new Date(a.deadline).toLocaleDateString("ko-KR")}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Header() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">과제 관리</h1>
        <p className="mt-1 text-sm text-gray-500">학급별로 과제를 출제하고 회차를 관리합니다.</p>
      </div>
      <Link href="/dashboard/assignments/new" className="btn-primary">
        <Plus className="h-4 w-4" />새 과제
      </Link>
    </div>
  );
}
