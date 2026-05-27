import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScanText } from "lucide-react";
import { OcrWorkspace } from "./OcrWorkspace";
import type { OcrPageData } from "./types";

export const dynamic = "force-dynamic";

export default async function TeacherOcrPage() {
  const session = (await getServerSession(authOptions))!;
  const teacherId = session.user.id;

  // 학급 + 학생 + 진행 중 과제 + 열린 회차
  const classes = await prisma.class.findMany({
    where: { teacherId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      year: true,
      students: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, name: true },
      },
      assignments: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          writingType: true,
          minChars: true,
          rounds: {
            where: { isOpen: true },
            orderBy: { roundNumber: "asc" },
            select: {
              id: true,
              roundNumber: true,
              title: true,
              deadline: true,
            },
          },
        },
      },
    },
  });

  // 빈 학급/과제 처리
  if (classes.length === 0) {
    return (
      <>
        <Header />
        <div className="card flex items-start gap-3">
          <ScanText className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
          <div>
            <h2 className="font-semibold text-gray-900">아직 학급이 없어요</h2>
            <p className="mt-1 text-sm text-gray-600">
              먼저 설정에서 학급과 학생을 등록한 뒤 과제를 만들면 사진을 인식해 제출할 수 있어요.
            </p>
            <Link href="/dashboard/settings" className="btn-primary mt-4 text-sm">
              학급 만들기
            </Link>
          </div>
        </div>
      </>
    );
  }

  const data: OcrPageData = {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      year: c.year,
      students: c.students,
      assignments: c.assignments.map((a) => ({
        id: a.id,
        title: a.title,
        writingType: a.writingType,
        minChars: a.minChars,
        rounds: a.rounds.map((r) => ({
          id: r.id,
          roundNumber: r.roundNumber,
          title: r.title,
          deadline: r.deadline.toISOString(),
        })),
      })),
    })),
  };

  return (
    <>
      <Header />
      <OcrWorkspace data={data} />
    </>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <p className="text-sm text-gray-500">사진을 글로 바꿔서 한 번에 제출하기</p>
      <h1 className="text-2xl font-bold text-gray-900">OCR 업로드</h1>
      <p className="mt-2 text-sm text-gray-600">
        개별 모드는 학생 한 명의 손글씨를 OCR해서 바로 저장하고, 일괄 모드는 여러 학생의 사진을
        한꺼번에 올려놓고 한 명씩 확인·저장합니다.
      </p>
    </div>
  );
}
