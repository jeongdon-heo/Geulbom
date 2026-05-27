"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="btn-secondary text-xs"
    >
      <LogOut className="h-3.5 w-3.5" />
      로그아웃
    </button>
  );
}
