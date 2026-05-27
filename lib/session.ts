import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

// ============================================================
// 서버 라우트/RSC에서 공통으로 쓰는 세션 가드
// ============================================================

export type GuardResult =
  | { ok: true; teacherId: string; role: string; email: string; name: string }
  | { ok: false; status: number; message: string };

export async function requireTeacher(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return { ok: false, status: 401, message: "로그인이 필요합니다." };
  return {
    ok: true,
    teacherId: session.user.id,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}

export async function requireAdmin(): Promise<GuardResult> {
  const res = await requireTeacher();
  if (!res.ok) return res;
  if (res.role !== "admin")
    return { ok: false, status: 403, message: "관리자 권한이 필요합니다." };
  return res;
}
