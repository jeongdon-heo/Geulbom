"use client";

import type { AIProvider } from "./ai";

// ============================================================
// 클라이언트 측 API 키 저장/조회
// localStorage에만 저장하고, 서버 호출 시 헤더로만 전송합니다.
// (서버는 절대 평문으로 영속화하지 않음)
// ============================================================

const STORAGE_KEYS: Record<AIProvider, string> = {
  gemini: "geulbom.apiKey.gemini",
  claude: "geulbom.apiKey.claude",
};

const PROVIDER_PREF_KEY = "geulbom.aiProvider";

export function getApiKey(provider: AIProvider): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEYS[provider]);
}

export function setApiKey(provider: AIProvider, key: string): void {
  if (typeof window === "undefined") return;
  if (!key) {
    window.localStorage.removeItem(STORAGE_KEYS[provider]);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS[provider], key);
}

export function clearApiKey(provider: AIProvider): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEYS[provider]);
}

export function getPreferredProvider(): AIProvider {
  if (typeof window === "undefined") return "gemini";
  const v = window.localStorage.getItem(PROVIDER_PREF_KEY);
  return v === "claude" ? "claude" : "gemini";
}

export function setPreferredProvider(provider: AIProvider): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROVIDER_PREF_KEY, provider);
}

/** API 호출용 헤더 — 선택된 제공자의 키를 자동으로 끼워줍니다. */
export function buildAIHeaders(provider?: AIProvider): HeadersInit {
  const p = provider ?? getPreferredProvider();
  const key = getApiKey(p);
  if (!key) return { "x-ai-provider": p };
  const headerName =
    p === "claude" ? "x-anthropic-api-key" : "x-gemini-api-key";
  return { "x-ai-provider": p, [headerName]: key };
}
