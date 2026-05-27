import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// ============================================================
// 학생 세션 (NextAuth와 별도)
// - JWT를 HTTP-only 쿠키 "geulbom-student"에 저장
// - 키는 NEXTAUTH_SECRET을 재사용 (별도 키가 필요하면 STUDENT_JWT_SECRET 추가)
// - 14일 만료
// ============================================================

export const STUDENT_COOKIE = "geulbom-student";
const MAX_AGE = 60 * 60 * 24 * 14; // 14일

export interface StudentSession {
  studentId: string;
  classId: string;
  number: number;
  name: string;
}

function getSecret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET이 설정되지 않았습니다.");
  return new TextEncoder().encode(s);
}

export async function signStudentToken(payload: StudentSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .setSubject(payload.studentId)
    .sign(getSecret());
}

export async function verifyStudentToken(token: string): Promise<StudentSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.studentId === "string" &&
      typeof payload.classId === "string" &&
      typeof payload.number === "number" &&
      typeof payload.name === "string"
    ) {
      return {
        studentId: payload.studentId,
        classId: payload.classId,
        number: payload.number,
        name: payload.name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** RSC/라우트 핸들러에서 현재 학생 세션 읽기 (없으면 null) */
export async function getStudentSession(): Promise<StudentSession | null> {
  const token = cookies().get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  return verifyStudentToken(token);
}

/** 가드: 없으면 401-형 에러 객체 반환 */
export async function requireStudent():
  Promise<
    | { ok: true; session: StudentSession }
    | { ok: false; status: number; message: string }
  > {
  const s = await getStudentSession();
  if (!s) return { ok: false, status: 401, message: "학생 로그인이 필요합니다." };
  return { ok: true, session: s };
}

/** 응답에 쿠키를 심을 때 쓰는 옵션 */
export const STUDENT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
