import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RubricManager, type RubricView } from "./RubricManager";

export const dynamic = "force-dynamic";

export default async function RubricsPage() {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const rubrics = await prisma.rubricTemplate.findMany({
    where: {
      OR: [{ teacherId }, { teacher: { role: "admin" } }],
    },
    orderBy: [{ createdAt: "asc" }],
    include: {
      teacher: { select: { id: true, name: true, role: true } },
      _count: { select: { assignments: true } },
    },
  });

  const initial: RubricView[] = rubrics.map((r) => ({
    id: r.id,
    name: r.name,
    totalScore: r.totalScore,
    // Json 컬럼은 JsonValue로 넘어오므로 unknown을 거쳐 클라이언트 타입으로 단언
    areas: (r.areas as unknown as RubricView["areas"]) ?? [],
    scoringGuide: (r.scoringGuide as unknown as RubricView["scoringGuide"]) ?? null,
    usageCount: r._count.assignments,
    isOwner: r.teacherId === teacherId,
    isShared: r.teacher.role === "admin" && r.teacherId !== teacherId,
    ownerName: r.teacher.name,
  }));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">루브릭 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          평가 영역과 배점, 채점 기준을 직접 만들고 과제에 적용할 수 있습니다.
          공용 루브릭은 복제해서 나만의 버전으로 수정하세요.
        </p>
      </div>

      <RubricManager initial={initial} />
    </>
  );
}
