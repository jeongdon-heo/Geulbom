import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getStudentSession } from "@/lib/student-session";
import { requireTeacher } from "@/lib/session";
import { getAI, getApiKeyFromHeaders, getProvider } from "@/lib/ai";
import { buildOcrPrompt } from "@/lib/prompts";
import { ocrResponseSchema } from "@/lib/ai-schemas";
import { ALLOWED_MIME, MAX_BYTES, uploadOcrImage } from "@/lib/supabase-storage";

// ============================================================
// POST /api/analyze/ocr
//   Content-Type: multipart/form-data
//   fields:
//     - image:             File (필수)
//     - assignmentRoundId: string (선택, 학생/교사 모두 권한 체크용)
//     - studentId:         string (선택, 교사 모드에서 학생 매칭)
//     - provider:          "gemini" | "claude" (선택, 헤더 x-ai-provider로도 가능)
//   Headers:
//     - x-ai-provider, x-gemini-api-key, x-anthropic-api-key
//
// 흐름:
//   1) 인증 (학생 세션 또는 교사 세션)
//   2) 회차/학생 권한 검증
//   3) Supabase Storage에 이미지 업로드
//   4) AI Vision으로 OCR 실행 → JSON 검증
//   5) { imageUrl, fullText, segments, overallConfidence, lowConfidenceWords, aiProvider } 반환
//   ※ OcrRecord 생성은 /api/submissions에서 ocr 메타데이터를 받아 함께 처리.
// ============================================================

interface AuthCtx {
  kind: "student" | "teacher";
  /** 학생일 때 studentId, 교사일 때 teacherId */
  actorId: string;
  /** 학생일 때 classId, 교사일 때는 비워둠 */
  classId?: string;
}

async function resolveAuth(): Promise<AuthCtx | null> {
  const student = await getStudentSession();
  if (student) {
    return {
      kind: "student",
      actorId: student.studentId,
      classId: student.classId,
    };
  }
  const teacher = await requireTeacher();
  if (teacher.ok) {
    return { kind: "teacher", actorId: teacher.teacherId };
  }
  return null;
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return fail("로그인이 필요합니다.", 401);

  // ── multipart 파싱 ──
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("multipart/form-data 형식이어야 합니다.");
  }

  const file = form.get("image");
  if (!(file instanceof File)) return fail("이미지 파일이 필요합니다.");
  if (!ALLOWED_MIME.has(file.type)) {
    return fail(`지원하지 않는 이미지 형식입니다: ${file.type || "unknown"}`);
  }
  if (file.size <= 0) return fail("이미지가 비어 있습니다.");
  if (file.size > MAX_BYTES) {
    return fail(`이미지가 너무 큽니다. (최대 ${Math.round(MAX_BYTES / 1024 / 1024)}MB)`);
  }

  const assignmentRoundId =
    typeof form.get("assignmentRoundId") === "string"
      ? (form.get("assignmentRoundId") as string)
      : null;
  const studentIdInput =
    typeof form.get("studentId") === "string" ? (form.get("studentId") as string) : null;
  const providerInput =
    typeof form.get("provider") === "string" ? (form.get("provider") as string) : null;

  // ── 회차/학생 권한 검증 ──
  let effectiveStudentId: string | null = null;
  let classId: string | null = null;

  if (assignmentRoundId) {
    const round = await prisma.assignmentRound.findUnique({
      where: { id: assignmentRoundId },
      include: {
        assignment: {
          select: {
            classId: true,
            class: { select: { teacherId: true } },
            isActive: true,
          },
        },
      },
    });
    if (!round) return fail("회차를 찾을 수 없습니다.", 404);
    if (!round.assignment.isActive) return fail("비활성화된 과제입니다.", 410);
    if (!round.isOpen) return fail("이 회차는 닫혀 있어요.", 410);

    if (auth.kind === "student") {
      if (round.assignment.classId !== auth.classId)
        return fail("이 과제에 접근할 수 없습니다.", 403);
      effectiveStudentId = auth.actorId;
    } else {
      if (round.assignment.class.teacherId !== auth.actorId)
        return fail("권한이 없습니다.", 403);
      if (!studentIdInput) return fail("교사 모드는 studentId가 필요합니다.");
      const target = await prisma.student.findUnique({
        where: { id: studentIdInput },
        select: { id: true, classId: true },
      });
      if (!target || target.classId !== round.assignment.classId) {
        return fail("학생이 이 학급 소속이 아닙니다.", 400);
      }
      effectiveStudentId = target.id;
    }
    classId = round.assignment.classId;
  } else {
    // 회차 없이 OCR 시범 사용 (저장만 못함). 학생/교사 모두 허용.
    if (auth.kind === "student") {
      effectiveStudentId = auth.actorId;
      classId = auth.classId ?? null;
    } else if (studentIdInput) {
      const target = await prisma.student.findUnique({
        where: { id: studentIdInput },
        include: { class: { select: { teacherId: true } } },
      });
      if (!target || target.class.teacherId !== auth.actorId)
        return fail("권한이 없습니다.", 403);
      effectiveStudentId = target.id;
      classId = target.classId;
    }
  }

  // ── Storage 업로드 ──
  const prefix = [
    classId ?? "loose",
    assignmentRoundId ?? "noround",
    effectiveStudentId ?? auth.actorId,
  ].join("/");

  let uploaded: { url: string; path: string };
  try {
    const buf = await file.arrayBuffer();
    const r = await uploadOcrImage({
      buffer: buf,
      mimeType: file.type,
      prefix,
      isPublic: false,
    });
    uploaded = { url: r.url, path: r.path };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "업로드 실패";
    return fail(`이미지 업로드 실패: ${msg}`, 502);
  }

  // ── AI Vision OCR ──
  const provider = getProvider(providerInput ?? req.headers.get("x-ai-provider"));
  const apiKey = getApiKeyFromHeaders(req.headers, provider);

  const prompt = buildOcrPrompt();
  let raw: unknown;
  try {
    const ai = getAI(provider, apiKey);
    // base64 인코딩 (Node Buffer 사용)
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    raw = await ai.generateJSONFromImage(prompt, base64, file.type);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 호출 실패";
    return fail(`OCR 실패: ${msg}`, 502);
  }

  const parsed = ocrResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      `OCR 응답이 예상 형식과 다릅니다: ${parsed.error.issues[0]?.message ?? ""}`,
      502
    );
  }

  return ok({
    imageUrl: uploaded.url,
    imagePath: uploaded.path,
    aiProvider: provider,
    fullText: parsed.data.fullText,
    segments: parsed.data.segments,
    overallConfidence: parsed.data.overallConfidence,
    lowConfidenceWords: parsed.data.lowConfidenceWords,
    studentId: effectiveStudentId,
    assignmentRoundId,
  });
}
