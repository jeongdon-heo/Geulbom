"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function StudentLogoutButton() {
  const router = useRouter();
  async function onLogout() {
    await fetch("/api/student-auth/logout", { method: "POST" });
    router.push("/student/login");
    router.refresh();
  }
  return (
    <button
      onClick={onLogout}
      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
      title="로그아웃"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
