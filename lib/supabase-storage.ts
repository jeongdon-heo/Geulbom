// ============================================================
// Supabase Storage 헬퍼 (서버 전용)
// - @supabase/supabase-js 의존성 없이 REST API 직접 호출
// - 서비스 롤 키 사용 (RLS 우회) → 절대 클라이언트로 노출 금지
// - 버킷은 미리 콘솔에서 생성. 기본값: ocr-images
// ============================================================

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export interface UploadResult {
  /** 외부에서 OCR 이미지 URL로 사용할 값 (Public 또는 Signed) */
  url: string;
  /** Storage 내부 경로 (bucket 제외) */
  path: string;
  bucket: string;
  mimeType: string;
  byteSize: number;
}

function getEnv(): { url: string; serviceRoleKey: string; bucket: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_OCR_BUCKET || "ocr-images";
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.");
  if (!serviceRoleKey)
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. (서버 전용 키)"
    );
  return { url: url.replace(/\/$/, ""), serviceRoleKey, bucket };
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

function randomKey(): string {
  // crypto.randomUUID()는 Node 19+ / Edge 양쪽에서 지원
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * 이미지 버퍼를 Supabase Storage에 업로드하고 접근 가능한 URL을 반환합니다.
 * - 버킷이 public이면 그대로 public URL
 * - 버킷이 private이면 짧은 유효기간의 서명 URL (1년)
 */
export async function uploadOcrImage(params: {
  buffer: ArrayBuffer | Uint8Array;
  mimeType: string;
  /** path prefix: e.g. "{classId}/{roundId}/{studentId}" */
  prefix: string;
  /** true면 public URL 반환, false면 1년 서명 URL */
  isPublic?: boolean;
}): Promise<UploadResult> {
  const { buffer, mimeType, prefix } = params;
  const isPublic = params.isPublic ?? false;

  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error(`지원하지 않는 이미지 형식입니다: ${mimeType}`);
  }
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength === 0) throw new Error("이미지가 비어 있습니다.");
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(
      `이미지가 너무 큽니다. 최대 ${Math.round(MAX_BYTES / 1024 / 1024)}MB`
    );
  }

  const { url, serviceRoleKey, bucket } = getEnv();
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_\-/]/g, "_");
  const path = `${safePrefix}/${Date.now()}-${randomKey()}.${extFromMime(mimeType)}`;
  const uploadUrl = `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": mimeType,
      "x-upsert": "false",
      "Cache-Control": "max-age=3600",
    },
    body: new Blob([new Uint8Array(bytes)], { type: mimeType }),
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(
      `Storage 업로드 실패 (${uploadRes.status}): ${text || uploadRes.statusText}`
    );
  }

  let publicOrSignedUrl: string;
  if (isPublic) {
    publicOrSignedUrl = `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  } else {
    publicOrSignedUrl = await createSignedUrl({ bucket, path, expiresIn: 60 * 60 * 24 * 365 });
  }

  return {
    url: publicOrSignedUrl,
    path,
    bucket,
    mimeType,
    byteSize: bytes.byteLength,
  };
}

/** 만료 시간(초) 동안 유효한 서명 URL 생성 */
export async function createSignedUrl(params: {
  bucket: string;
  path: string;
  expiresIn: number;
}): Promise<string> {
  const { url, serviceRoleKey } = getEnv();
  const endpoint = `${url}/storage/v1/object/sign/${encodeURIComponent(params.bucket)}/${params.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: params.expiresIn }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Signed URL 발급 실패 (${res.status}): ${text || res.statusText}`
    );
  }
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL ?? data.signedUrl;
  if (!signed) throw new Error("Signed URL 응답이 비어 있습니다.");
  // signedURL은 보통 "/object/sign/..." 같은 상대 경로. 절대 URL로 변환.
  return signed.startsWith("http") ? signed : `${url}/storage/v1${signed}`;
}

export { ALLOWED_MIME, MAX_BYTES };
