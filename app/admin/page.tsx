import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminInviteCodes } from "./AdminInviteCodes";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">접근 권한 없음</h1>
        <p className="mt-2 text-sm text-gray-600">
          관리자만 접근할 수 있는 페이지입니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">관리자</h1>
        <p className="mt-1 text-sm text-gray-500">
          교사 가입용 초대코드를 발급하고 관리합니다.
        </p>
      </div>

      <AdminInviteCodes />
    </main>
  );
}
