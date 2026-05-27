import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getStudentSession } from "@/lib/student-session";
import { StudentBottomNav } from "./StudentBottomNav";

export const dynamic = "force-dynamic";

export default async function StudentAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getStudentSession();
  if (!s) {
    // 현재 경로를 callbackUrl로 넘겨서 로그인 후 복귀
    const path = headers().get("x-pathname") || "/student/home";
    redirect(`/student/login?callbackUrl=${encodeURIComponent(path)}`);
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      {children}
      <StudentBottomNav />
    </div>
  );
}
