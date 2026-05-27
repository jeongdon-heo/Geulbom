import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "./DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? "선생님",
        email: session.user.email ?? "",
        role: session.user.role,
      }}
    >
      {children}
    </DashboardShell>
  );
}
