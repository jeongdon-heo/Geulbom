import Link from "next/link";
import { Sprout, Users, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-bg to-bg-subtle">
      {/* 헤더 */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Sprout className="h-7 w-7 text-teal" />
          <span className="text-xl font-bold text-teal-700">글봄</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/student/login"
            className="text-sm font-medium text-gray-600 hover:text-teal"
          >
            학생 로그인
          </Link>
          <Link href="/login" className="btn-secondary">
            교사 로그인
          </Link>
        </nav>
      </header>

      {/* 히어로 */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="mb-3 text-sm font-medium text-teal-600">
          NugaBom 시리즈
        </p>
        <h1 className="text-5xl font-bold leading-tight text-gray-900">
          글을 보고,
          <br />
          <span className="text-teal">성장의 봄</span>을 맞이하다
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          초등학생의 글쓰기를 AI가 분석하고, 선생님이 따뜻하게 다듬어 전달합니다.
          학생은 자신의 성장을 한눈에 확인할 수 있어요.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3">
            교사로 시작하기
          </Link>
          <Link href="/student/login" className="btn-secondary px-6 py-3">
            학생으로 들어가기
          </Link>
        </div>
      </section>

      {/* 특징 */}
      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        <Feature
          icon={<Sparkles className="h-6 w-6 text-area-expression" />}
          title="AI 자동 분석"
          desc="Gemini/Claude 중 선택해 글을 다섯 영역으로 채점하고 피드백을 생성합니다."
        />
        <Feature
          icon={<Users className="h-6 w-6 text-area-structure" />}
          title="교사가 최종 책임"
          desc="AI 결과는 검토 대기 상태로 들어오고, 교사가 승인해야 학생에게 공개됩니다."
        />
        <Feature
          icon={<Sprout className="h-6 w-6 text-teal" />}
          title="성장 시각화"
          desc="영역별 점수 추이와 뱃지로 아이의 글쓰기 성장을 한눈에 보여줍니다."
        />
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card">
      <div className="mb-3">{icon}</div>
      <h3 className="mb-1 font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
    </div>
  );
}
