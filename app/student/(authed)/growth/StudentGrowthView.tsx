"use client";

import Link from "next/link";
import { Award, Lock, Sparkles, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  getAreaColor,
  type BadgeStatus,
  type GrowthAnalysis,
  type RubricArea,
} from "@/lib/growth";

interface Writing {
  submissionId: string;
  feedbackId: string;
  roundNumber: number;
  title: string;
  writingType: string;
  textPreview: string;
  totalScore: number;
  approvedAt: string;
}

export function StudentGrowthView({
  studentName,
  rubricAreas,
  analysis,
  badges,
  writings,
}: {
  studentName: string;
  rubricAreas: RubricArea[];
  analysis: GrowthAnalysis;
  badges: BadgeStatus[];
  writings: Writing[];
}) {
  const totalScoreCap = rubricAreas.reduce((s, a) => s + a.maxScore, 0) || 100;
  const areaCap = Math.max(...rubricAreas.map((a) => a.maxScore), 20);

  return (
    <main className="mx-auto max-w-md px-5 pt-6 md:max-w-4xl pb-24">
      <h1 className="text-2xl font-bold text-gray-900">나의 성장</h1>
      <p className="mt-1 text-sm text-gray-500">
        {studentName} 학생이 쓴 글 {analysis.count}편의 기록이에요.
      </p>

      {/* 인사이트 카드 */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <StatBox
          label="최근 평균 점수"
          value={
            analysis.recentAverageTotal !== null
              ? `${analysis.recentAverageTotal}점`
              : "—"
          }
          hint={`만점 ${totalScoreCap}`}
          tone="teal"
        />
        <StatBox
          label="첫 글 대비"
          value={
            analysis.totalDelta !== null
              ? `${analysis.totalDelta >= 0 ? "+" : ""}${analysis.totalDelta}점`
              : "—"
          }
          hint={
            analysis.totalDelta !== null && analysis.totalDelta >= 0
              ? "쑥쑥 자라고 있어요"
              : "괜찮아요, 다시 도전!"
          }
          tone={analysis.totalDelta && analysis.totalDelta < 0 ? "warm" : "teal"}
        />
      </section>

      {analysis.mostGrown && (
        <section className="mt-3 rounded-xl border border-teal-100 bg-teal-50 p-3">
          <p className="text-xs text-teal-700">AI 분석</p>
          <p className="mt-0.5 text-sm font-medium text-teal-700">
            <TrendingUp className="mr-1 inline h-4 w-4" />
            가장 성장한 영역은{" "}
            <strong>{analysis.mostGrown.areaName}</strong> (
            {analysis.mostGrown.delta >= 0 ? "+" : ""}
            {analysis.mostGrown.delta}점)이에요.
            {analysis.mostStagnant &&
              analysis.mostStagnant.areaKey !== analysis.mostGrown.areaKey && (
                <>
                  {" "}
                  <span className="text-gray-600">
                    조금 더 신경쓰면 좋은 영역은{" "}
                    <strong>{analysis.mostStagnant.areaName}</strong>이에요.
                  </span>
                </>
              )}
          </p>
        </section>
      )}

      {/* 총점 추이 그래프 */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">총점 추이</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={analysis.timeline}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  domain={[0, totalScoreCap]}
                  width={32}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelStyle={{ color: "#555" }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="총점"
                  stroke="#1D9E75"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 영역별 추이 */}
      {rubricAreas.length > 0 && analysis.timeline.length >= 1 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">영역별 점수</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={analysis.timeline}
                  margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, areaCap]} width={28} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                    iconType="circle"
                  />
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
        </section>
      )}

      {/* 뱃지 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">받은 뱃지</h2>
        <div className="grid grid-cols-2 gap-3">
          {badges.map((b) => (
            <BadgeCard key={b.key} badge={b} />
          ))}
        </div>
      </section>

      {/* 글 모아보기 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">내가 쓴 글들</h2>
        <ul className="space-y-2">
          {writings
            .slice()
            .reverse() // 최신부터
            .map((w) => (
              <li key={w.feedbackId}>
                <Link
                  href={`/student/feedback/${w.submissionId}`}
                  className="block rounded-xl border border-gray-200 bg-white p-3 transition hover:border-teal-500 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {w.writingType} · {w.roundNumber}회차
                    </span>
                    <span className="font-semibold text-teal-700">
                      {w.totalScore}점
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-gray-900">{w.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                    {w.textPreview}…
                  </p>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </main>
  );
}

function StatBox({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "teal" | "warm";
}) {
  const cls =
    tone === "teal"
      ? "border-teal-100 bg-teal-50 text-teal-700"
      : "border-area-grammar/20 bg-area-grammar/5 text-area-grammar";
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-[11px] font-medium">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] opacity-80">{hint}</p>}
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeStatus }) {
  const Icon = badge.achieved ? Award : Lock;
  const tone = badge.achieved
    ? "border-teal-200 bg-teal-50"
    : "border-gray-200 bg-gray-50";
  const iconCls = badge.achieved ? "text-teal-700" : "text-gray-400";
  const titleCls = badge.achieved ? "text-teal-700" : "text-gray-500";
  return (
    <div className={`relative overflow-hidden rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconCls}`} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${titleCls}`}>{badge.label}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">{badge.description}</p>
          {badge.progressLabel && (
            <p className="mt-1 text-[11px] font-medium text-gray-700">
              {badge.achieved ? (
                <>
                  <Sparkles className="mr-0.5 inline h-3 w-3 text-teal-500" />
                  {badge.progressLabel}
                </>
              ) : (
                badge.progressLabel
              )}
            </p>
          )}
        </div>
      </div>
      {!badge.achieved && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-teal-400"
            style={{ width: `${Math.min(100, Math.round(badge.progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
