"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    inviteCode: "",
    email: "",
    password: "",
    name: "",
    school: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/teachers/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          inviteCode: form.inviteCode.toUpperCase().trim(),
          email: form.email.toLowerCase().trim(),
          school: form.school || undefined,
        }),
      });
      const body: ApiResp<{ id: string }> = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error || "회원가입에 실패했습니다.");
        setLoading(false);
        return;
      }

      // 가입 직후 자동 로그인
      const signin = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      setLoading(false);
      if (!signin || signin.error) {
        // 가입은 됐는데 로그인 실패 → 로그인 페이지로
        router.push("/login");
        return;
      }
      router.push(signin.url || "/dashboard");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">교사 회원가입</h1>
      <p className="mb-6 text-sm text-gray-500">
        관리자에게 받은 초대코드로 가입하세요.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="inviteCode">
            초대코드 (8자)
          </label>
          <input
            id="inviteCode"
            type="text"
            required
            maxLength={8}
            value={form.inviteCode}
            onChange={(e) => setField("inviteCode", e.target.value.toUpperCase())}
            className="input font-mono tracking-widest"
            placeholder="ABCD2345"
          />
        </div>

        <div>
          <label className="label" htmlFor="name">
            이름
          </label>
          <input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            className="input"
            placeholder="홍길동"
          />
        </div>

        <div>
          <label className="label" htmlFor="school">
            소속 학교 (선택)
          </label>
          <input
            id="school"
            type="text"
            value={form.school}
            onChange={(e) => setField("school", e.target.value)}
            className="input"
            placeholder="OO초등학교"
          />
        </div>

        <div>
          <label className="label" htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            className="input"
            placeholder="teacher@school.kr"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            비밀번호 (8자 이상)
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary w-full py-2.5"
          disabled={loading}
        >
          {loading ? "가입 중..." : "가입하고 시작하기"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-teal hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
