"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sprout } from "lucide-react";
import { Suspense } from "react";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/student/home";

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/student-auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        pin: pin || null,
      }),
    });
    const body: ApiResp<unknown> = await res.json();
    setLoading(false);

    if (!body.success) {
      setError(body.error || "로그인에 실패했습니다.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-7 shadow-sm">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">학생 로그인</h1>
      <p className="mb-6 text-sm text-gray-500">
        이름을 입력하고 들어와요.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">
            이름
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="예: 김글봄"
          />
        </div>
        <div>
          <label className="label" htmlFor="pin">
            PIN (선생님이 알려준 경우만)
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="input"
            placeholder="••••"
            maxLength={10}
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? "들어가는 중..." : "들어가기"}
        </button>
      </form>
    </div>
  );
}

export default function StudentLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-bg to-bg-subtle">
      <header className="mx-auto max-w-md px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Sprout className="h-7 w-7 text-teal" />
          <span className="text-xl font-bold text-teal-700">글봄</span>
        </Link>
      </header>
      <main className="mx-auto max-w-md px-6 pb-10">
        <Suspense fallback={<div className="card">불러오는 중...</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
