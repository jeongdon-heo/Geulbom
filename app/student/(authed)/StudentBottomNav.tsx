"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PenSquare, MessageCircle, Sprout, FileText } from "lucide-react";

const ITEMS = [
  { href: "/student/home", label: "홈", icon: Home },
  { href: "/student/write", label: "글쓰기", icon: PenSquare },
  { href: "/student/feedback", label: "피드백", icon: MessageCircle },
  { href: "/student/growth", label: "성장", icon: Sprout },
  { href: "/student/report", label: "보고서", icon: FileText },
];

export function StudentBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white">
      <ul className="mx-auto flex max-w-md md:max-w-4xl">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active =
            pathname === it.href ||
            (it.href !== "/student/home" && pathname.startsWith(it.href));
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
                  active ? "text-teal" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Icon className="h-5 w-5" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
