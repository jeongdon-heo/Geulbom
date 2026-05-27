import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LineChart, Users } from "lucide-react";
import {
  analyzeGrowth,
  evaluateBadges,
  type FeedbackPoint,
  type RubricArea,
} from "@/lib/growth";
import { TeacherGrowthView } from "./TeacherGrowthView";

export const dynamic = "force-dynamic";

interface SearchParams {
  classId?: string;
  studentId?: string;
}

export default async function TeacherGrowthPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  const classes = await prisma.class.findMany({
    where: { teacherId },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, year: true },
  });

  if (classes.length === 0) {
    return (
      <>
        <Header />
        <div className="card flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
          <div>
            <h2 className="font-semibold text-gray-900">학급이 없어요</h2>
            <p className="mt-1 text-sm text-gray-600">
              먼저 설정에서 학급과 학생을 등록한 후 글이 쌓이면 여기에 성장 분석이 표시돼요.
            </p>
            <Link href="/dashboard/settings" className="btn-primary mt-4 text-sm">
              학급 만들기
            </Link>
          </div>
        </div>
      </>
    );
  }

  const selectedClassId =
    searchParams.classId && classes.some((c) => c.id === searchParams.classId)
      ? searchParams.classId
      : classes[0].id;

  // 선택된 학급의 학생 + 피드백 (시간순)
  const [students, feedbacks] = await Promise.all([
    prisma.student.findMany({
      where: { classId: selectedClassId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, name: true },
    }),
    prisma.feedback.findMany({
      where: {
        submission: {
          assignmentRound: { assignment: { classId: selectedClassId } },
        },
      },
      orderBy: { createdAt: "asc" },
      include: {
        submission: {
          select: {
            studentId: true,
            assignmentRound: {
              select: {
                roundNumber: true,
                assignment: {
                  select: {
                    id: true,
                    title: true,
                    rubricTemplate: { select: { id: true, areas: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // 학급에 피드백이 하나도 없으면 빈 상태
  if (feedbacks.length === 0) {
    return (
      <>
        <Header />
        <ClassTabs classes={classes} selectedId={selectedClassId} />
        <div className="card flex items-start gap-3">
          <LineChart className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
          <div>
            <p className="text-sm text-gray-700">
              이 학급은 아직 분석된 글이 없어요. 학생들이 글을 제출하고 AI 분석이 완료되면 여기에 그래프가
              나타나요.
            </p>
          </div>
        </div>
      </>
    );
  }

  const latest = feedbacks[feedbacks.length - 1];
  const rubricAreas =
    (latest.submission.assignmentRound.assignment.rubricTemplate
      ?.areas as unknown as RubricArea[]) ?? [];

  // 학생 ID → name 매핑
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // 학급 전체 평균: 회차별 평균 (회차 번호 기준 그룹)
  const allPoints: FeedbackPoint[] = feedbacks.map((f) => ({
    roundNumber: f.submission.assignmentRound.roundNumber,
    assignmentTitle: f.submission.assignmentRound.assignment.title,
    date: (f.approvedAt ?? f.createdAt).toISOString(),
    scores: f.scores as unknown as Record<string, number>,
    totalScore: f.totalScore,
    approved: f.approvalStatus === "APPROVED",
  }));

  // 회차별 그룹화 → 평균 totalScore + 영역별 평균
  const byRound = new Map<
    number,
    {
      totals: number[];
      areaSums: Record<string, number[]>;
    }
  >();
  for (const p of allPoints) {
    const cur = byRound.get(p.roundNumber) ?? { totals: [], areaSums: {} };
    cur.totals.push(p.totalScore);
    for (const a of rubricAreas) {
      const v = p.scores[a.key];
      if (typeof v === "number") {
        cur.areaSums[a.key] = cur.areaSums[a.key] ?? [];
        cur.areaSums[a.key].push(v);
      }
    }
    byRound.set(p.roundNumber, cur);
  }
  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;

  const classAveragePoints: FeedbackPoint[] = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, agg]) => ({
      roundNumber: round,
      assignmentTitle: "",
      date: "",
      totalScore: Math.round(avg(agg.totals)),
      scores: rubricAreas.reduce<Record<string, number>>((obj, a) => {
        obj[a.key] = Math.round(avg(agg.areaSums[a.key] ?? []));
        return obj;
      }, {}),
      approved: true,
    }));
  const classAnalysis = analyzeGrowth(classAveragePoints, rubricAreas);

  // 학생별 인덱스 (각 학생의 피드백 개수 + 최근 평균)
  const studentStats = students.map((s) => {
    const pts = allPoints.filter(
      (_, i) => feedbacks[i].submission.studentId === s.id
    );
    const totals = pts.map((p) => p.totalScore);
    return {
      id: s.id,
      number: s.number,
      name: s.name,
      count: pts.length,
      latest: totals[totals.length - 1] ?? null,
      average:
        totals.length === 0
          ? null
          : Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10,
    };
  });

  // 학생 개별 모드?
  const studentId =
    searchParams.studentId && students.some((s) => s.id === searchParams.studentId)
      ? searchParams.studentId
      : null;

  let studentBlock = null;
  if (studentId) {
    const studentPts: FeedbackPoint[] = [];
    feedbacks.forEach((f) => {
      if (f.submission.studentId !== studentId) return;
      studentPts.push({
        roundNumber: f.submission.assignmentRound.roundNumber,
        assignmentTitle: f.submission.assignmentRound.assignment.title,
        date: (f.approvedAt ?? f.createdAt).toISOString(),
        scores: f.scores as unknown as Record<string, number>,
        totalScore: f.totalScore,
        approved: f.approvalStatus === "APPROVED",
      });
    });
    const studentAnalysis = analyzeGrowth(studentPts, rubricAreas);
    const studentBadges = evaluateBadges(studentPts, rubricAreas);
    const target = studentMap.get(studentId)!;
    studentBlock = {
      student: { id: target.id, number: target.number, name: target.name },
      analysis: studentAnalysis,
      badges: studentBadges,
    };
  }

  return (
    <>
      <Header />
      <ClassTabs classes={classes} selectedId={selectedClassId} />
      <TeacherGrowthView
        classId={selectedClassId}
        rubricAreas={rubricAreas}
        classAnalysis={classAnalysis}
        students={studentStats}
        selectedStudent={studentBlock}
      />
    </>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">성장 분석</h1>
      <p className="mt-1 text-sm text-gray-500">
        학급 전체의 점수 추이와 각 학생의 성장을 한눈에 확인하세요.
      </p>
    </div>
  );
}

function ClassTabs({
  classes,
  selectedId,
}: {
  classes: { id: string; name: string; year: number }[];
  selectedId: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {classes.map((c) => {
        const active = c.id === selectedId;
        return (
          <Link
            key={c.id}
            href={`/dashboard/growth?classId=${c.id}`}
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
  );
}
