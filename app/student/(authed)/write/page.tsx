import { redirect } from "next/navigation";

// 글쓰기 탭은 홈과 거의 동일 — 단순히 홈으로 보냅니다.
export default function WriteIndexPage() {
  redirect("/student/home");
}
