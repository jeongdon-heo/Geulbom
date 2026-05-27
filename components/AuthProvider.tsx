"use client";

import { SessionProvider } from "next-auth/react";

/**
 * NextAuth 세션을 클라이언트 트리에 주입하는 래퍼.
 * 학생 인증은 별도 쿠키 기반이므로 이 Provider와 무관합니다.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
