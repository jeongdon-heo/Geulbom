import { NextResponse } from "next/server";
import { STUDENT_COOKIE } from "@/lib/student-session";

export async function POST() {
  const res = NextResponse.json({ success: true, data: { ok: true } });
  res.cookies.delete(STUDENT_COOKIE);
  return res;
}
