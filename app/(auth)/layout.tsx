import Link from "next/link";
import { Sprout } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-bg to-bg-subtle">
      <header className="mx-auto max-w-6xl px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <Sprout className="h-7 w-7 text-teal" />
          <span className="text-xl font-bold text-teal-700">글봄</span>
        </Link>
      </header>
      <main className="mx-auto flex max-w-md flex-col px-6 py-10">{children}</main>
    </div>
  );
}
