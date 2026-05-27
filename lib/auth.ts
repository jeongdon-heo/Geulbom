import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

// ============================================================
// NextAuth 설정 (교사 전용)
// 학생 인증은 별도 경로 /api/student-auth에서 처리합니다.
// ============================================================

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 14, // 2주
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "교사 로그인",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const teacher = await prisma.teacher.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!teacher) return null;

        const ok = await bcrypt.compare(credentials.password, teacher.password);
        if (!ok) return null;

        return {
          id: teacher.id,
          email: teacher.email,
          name: teacher.name,
          role: teacher.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // 로그인 직후에만 user가 채워짐
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "teacher";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
