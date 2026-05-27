import { withAuth } from "next-auth/middleware";

// ============================================================
// 교사 보호 라우트
// /dashboard, /admin 하위는 NextAuth 토큰이 있어야 진입 가능.
// (관리자 권한 체크는 각 페이지/라우트에서 추가로 수행)
// 학생 인증은 별도이므로 여기서 다루지 않습니다.
// ============================================================

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
