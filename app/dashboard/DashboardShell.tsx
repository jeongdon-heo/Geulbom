"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home,
  ClipboardList,
  CheckSquare,
  Users,
  LineChart,
  Settings,
  Sprout,
  LogOut,
  ShieldCheck,
  ScanText,
  FileText,
  ListChecks,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: Home },
  { href: "/dashboard/assignments", label: "과제 관리", icon: ClipboardList },
  { href: "/dashboard/rubrics", label: "루브릭 관리", icon: ListChecks },
  { href: "/dashboard/feedback", label: "피드백 검토", icon: CheckSquare },
  { href: "/dashboard/students", label: "학생 포트폴리오", icon: Users },
  { href: "/dashboard/ocr", label: "OCR 업로드", icon: ScanText },
  { href: "/dashboard/growth", label: "성장 분석", icon: LineChart },
  { href: "/dashboard/reports", label: "학년말 보고서", icon: FileText },
];

export function DashboardShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* 사이드바 */}
      <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white p-4 md:flex md:flex-col">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <Sprout className="h-7 w-7 text-teal" />
          <span className="text-xl font-bold text-teal-700">글봄</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-teal-50 text-teal-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="my-3 border-t border-gray-100" />

          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive("/dashboard/settings")
                ? "bg-teal-50 text-teal-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Settings className="h-4 w-4" />
            설정
          </Link>

          {user.role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <ShieldCheck className="h-4 w-4" />
              관리자
            </Link>
          )}
        </nav>

        {/* 사용자 */}
        <div className="border-t border-gray-100 pt-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 */}
      <div className="flex-1">
        {/* 모바일 상단바 */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Sprout className="h-6 w-6 text-teal" />
            <span className="font-bold text-teal-700">글봄</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-gray-600"
          >
            로그아웃
          </button>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
