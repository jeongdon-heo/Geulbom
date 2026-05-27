"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Award, Lock, TrendingUp, User2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAreaColor,
  type BadgeStatus,
  type GrowthAnalysis,
  type RubricArea,
} from "@/lib/growth";

interface StudentStat {
  id: string;
  number: number;
  name: string;
  count: number;
  latest: number | null;
  average: number | null;
}

interface StudentBlock {
  student: { id: string; number: number; name: string };
  analysis: GrowthAnalysis;
  badges: BadgeStatus[];
}

export function TeacherGrowthView({
  classId,
  rubricAreas,
  classAnalysis,
  students,
  selectedStudent,
}: {
  classId: string;
  rubricAreas: RubricArea[];
  classAnalysis: GrowthAnalysis;
  students: StudentStat[];
  selectedStudent: StudentBlock | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectStudent(studentId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("classId", classId);
    if (studentId) params.set("studentId", studentId);
    else params.delete("studentId");
    router.push(`/dashboard/growth?${params.toString()}`);
  }

  const totalScoreCap = rubricAreas.reduce((s, a) => s + a.maxScore, 0) || 100;
  const areaCap = Math.max(...rubricAreas.map((a) => a.maxScore), 20);

  // 영역별 학급 평균 막대 (최근 분석에서)
  const areaBars = classAnalysis.areaInsights.map((ai, i) => ({
    name: ai.areaName,
    avg: ai.average,
    fill: getAreaColor(ai.areaKey, i),
  }));

  return (
    <div className="space-y-8">
      {/* 모드 토글 */}
      <div className="flex flex-wrap items-center gap-2">
        <ModeBtn
          active={!selectedStudent}
          onClick={() => selectStudent(null)}
          label="학급 전체"
        />
        <span className="text-xs text-gray-400">|</span>
        <p className="text-xs text-gray-500">학생을 클릭하면 개별 분석으로 전환돼요.</p>
      </div>

      {!selectedStudent && (
        <>
          {/* 학급 전체 인사이트 */}
          <section className="grid gap-3 md:grid-cols-3">
            <StatBox
              label="분석 회차 수"
              value={`${classAnalysis.count}편`}
              hint="누적 피드백"
            />
            <StatBox
              label="최근 평균 총점"
              value={
                classAnalysis.recentAverageTotal !== null
                  ? `${classAnalysis.recentAverageTotal}점`
                  : "—"
              }
              hint={`만점 ${totalScoreCap}`}
            />
            <StatBox
              label="첫→최근 변화"
              value={
                classAnalysis.totalDelta !== null
                  ? `${classAnalysis.totalDelta >= 0 ? "+" : ""}${classAnalysis.totalDelta}점`
                  : "—"
              }
              tone={classAnalysis.totalDelta && classAnalysis.totalDelta < 0 ? "warm" : "teal"}
            />
          </section>

          {classAnalysis.mostGrown && (
            <p className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-700">
              <TrendingUp className="mr-1 inline h-4 w-4" />
              학급에서 가장 성장한 영역은{" "}
              <strong>{classAnalysis.mostGrown.areaName}</strong> (
              {classAnalysis.mostGrown.delta >= 0 ? "+" : ""}
              {classAnalysis.mostGrown.delta}점)이에요.
              {classAnalysis.mostStagnant &&
                classAnalysis.mostStagnant.areaKey !==
                  classAnalysis.mostGrown.areaKey && (
                  <>
                    {" "}
                    아직 부족한 영역은{" "}
                    <strong>{classAnalysis.mostStagnant.areaName}</strong>
                    {" "}({classAnalysis.mostStagnant.delta >= 0 ? "+" : ""}
                    {classAnalysis.mostStagnant.delta}점)이에요.
                  </>
                )}
            </p>
          )}

          {/* 회차별 평균 총점 추이 */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">
              회차별 평균 총점
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={classAnalysis.timeline}
                    margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      domain={[0, totalScoreCap]}
                      width={36}
                    />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="학급 평균"
                      stroke="#1D9E75"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* 영역별 학급 평균 */}
          {rubricAreas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                영역별 평균
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaBars}>
                      <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        domain={[0, areaCap]}
                        width={32}
                      />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="avg" name="평균 점수" radius={[6, 6, 0, 0]}>
                        {areaBars.map((b, i) => (
                          <Cell key={i} fill={b.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* 학생 목록 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          학생별 요약 ({students.length}명)
        </h2>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => {
            const isSelected = selectedStudent?.student.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectStudent(isSelected ? null : s.id)}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? "border-teal bg-teal-50"
                    : "border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{s.number}번</p>
                  <p className="truncate font-semibold text-gray-900">{s.name}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold text-gray-900">
                    {s.latest !== null ? `${s.latest}점` : "—"}
                  </p>
                  <p className="text-gray-500">
                    {s.count > 0 ? `평균 ${s.average}` : "글 없음"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 학생 개별 분석 */}
      {selectedStudent && (
        <StudentBlockView block={selectedStudent} rubricAreas={rubricAreas} />
      )}
    </div>
  );
}

function StudentBlockView({
  block,
  rubricAreas,
}: {
  block: StudentBlock;
  rubricAreas: RubricArea[];
}) {
  const totalScoreCap = rubricAreas.reduce((s, a) => s + a.maxScore, 0) || 100;
  const areaCap = Math.max(...rubricAreas.map((a) => a.maxScore), 20);
  return (
    <section className="space-y-4 rounded-xl border border-teal-100 bg-teal-50/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User2 className="h-5 w-5 text-teal-700" />
          <h2 className="text-lg font-bold text-gray-900">
            {block.student.number}번 {block.student.name}
          </h2>
        </div>
        <Link
          href={`/dashboard/students/${block.student.id}`}
          className="text-xs text-teal-700 hover:underline"
        >
          포트폴리오 전체 보기 →
        </Link>
      </div>

      {block.analysis.count === 0 ? (
        <p className="text-sm text-gray-600">이 학생은 아직 분석된 글이 없어요.</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <StatBox
              label="분석 회차"
              value={`${block.analysis.count}편`}
            />
            <StatBox
              label="최근 평균"
              value={
                block.analysis.recentAverageTotal !== null
                  ? `${block.analysis.recentAverageTotal}점`
                  : "—"
              }
              hint={`만점 ${totalScoreCap}`}
            />
            <StatBox
              label="첫→최근 변화"
              value={
                block.analysis.totalDelta !== null
                  ? `${block.analysis.totalDelta >= 0 ? "+" : ""}${block.analysis.totalDelta}점`
                  : "—"
              }
              tone={
                block.analysis.totalDelta && block.analysis.totalDelta < 0
                  ? "warm"
                  : "teal"
              }
            />
          </div>

          {block.analysis.mostGrown && (
            <p className="rounded-lg border border-white bg-white p-3 text-sm text-gray-700">
              <TrendingUp className="mr-1 inline h-4 w-4 text-teal-600" />
              가장 성장한 영역: <strong>{block.analysis.mostGrown.areaName}</strong> (
              {block.analysis.mostGrown.delta >= 0 ? "+" : ""}
              {block.analysis.mostGrown.delta}점)
              {block.analysis.mostStagnant &&
                block.analysis.mostStagnant.areaKey !==
                  block.analysis.mostGrown.areaKey && (
                  <>
                    {" · "}
                    정체 영역: <strong>{block.analysis.mostStagnant.areaName}</strong> (
                    {block.analysis.mostStagnant.delta >= 0 ? "+" : ""}
                    {block.analysis.mostStagnant.delta}점)
                  </>
                )}
            </p>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">영역별 추이</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={block.analysis.timeline}
                  margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, areaCap]} width={32} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  {rubricAreas.map((a, i) => (
                    <Line
                      key={a.key}
                      type="monotone"
                      dataKey={a.key}
                      name={a.name}
                      stroke={getAreaColor(a.key, i)}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">획득 뱃지</h3>
            <div className="grid gap-2 md:grid-cols-4">
              {block.badges.map((b) => (
                <div
                  key={b.key}
                  className={`rounded-lg border p-2 text-xs ${
                    b.achieved
                      ? "border-teal-200 bg-white text-teal-700"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {b.achieved ? (
                      <Award className="h-3.5 w-3.5" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    <span className="font-semibold">{b.label}</span>
                  </div>
                  {b.progressLabel && (
                    <p className="mt-0.5 text-[11px] opacity-80">{b.progressLabel}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ModeBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-teal text-white"
          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function StatBox({
  label,
  value,
  hint,
  tone = "teal",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "teal" | "warm";
}) {
  const cls =
    tone === "teal"
      ? "border-gray-200 bg-white"
      : "border-area-grammar/20 bg-area-grammar/5";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
