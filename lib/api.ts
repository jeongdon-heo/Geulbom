import { NextResponse } from "next/server";

// ============================================================
// API 응답 형식 통일
// 모든 라우트는 { success, data?, error? } 구조로 응답합니다.
// ============================================================

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string };

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(error: string, status = 400): NextResponse<ApiError> {
  return NextResponse.json({ success: false, error }, { status });
}
