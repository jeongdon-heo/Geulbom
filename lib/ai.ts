import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// AI 제공자 추상화
// Gemini / Claude를 동일 인터페이스로 호출하기 위한 래퍼.
// 키는 클라이언트가 헤더로 전달하거나, 서버 .env의 fallback 키를 사용합니다.
// ============================================================

export type AIProvider = "gemini" | "claude";

const GEMINI_MODEL = "gemini-2.0-flash";
const CLAUDE_MODEL = "claude-sonnet-4-6";

export interface AIClient {
  provider: AIProvider;
  /** 텍스트 프롬프트로 JSON을 반환받습니다. */
  generateJSON(prompt: string): Promise<unknown>;
  /** 이미지 + 텍스트 프롬프트(예: OCR). image는 base64 또는 데이터 URL. */
  generateJSONFromImage(prompt: string, imageBase64: string, mimeType: string): Promise<unknown>;
}

// ────────────────────────────────────────
// 유틸: 문자열에서 첫 JSON 객체 안전 추출
// ────────────────────────────────────────

function parseJsonLoose(text: string): unknown {
  // 코드펜스 제거
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // 본문 안에서 첫 { ... 마지막 } 만 추출 시도
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI 응답을 JSON으로 파싱하지 못했습니다.");
  }
}

// ────────────────────────────────────────
// Gemini 구현
// ────────────────────────────────────────

class GeminiClient implements AIClient {
  provider: AIProvider = "gemini";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateJSON(prompt: string): Promise<unknown> {
    const model = this.client.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonLoose(text);
  }

  async generateJSONFromImage(
    prompt: string,
    imageBase64: string,
    mimeType: string
  ): Promise<unknown> {
    const model = this.client.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      { text: prompt },
    ]);
    const text = result.response.text();
    return parseJsonLoose(text);
  }
}

// ────────────────────────────────────────
// Claude 구현
// ────────────────────────────────────────

class ClaudeClient implements AIClient {
  provider: AIProvider = "claude";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateJSON(prompt: string): Promise<unknown> {
    const msg = await this.client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return parseJsonLoose(text);
  }

  async generateJSONFromImage(
    prompt: string,
    imageBase64: string,
    mimeType: string
  ): Promise<unknown> {
    const msg = await this.client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return parseJsonLoose(text);
  }
}

// ────────────────────────────────────────
// 공개 팩토리
// ────────────────────────────────────────

/** 요청에서 제공자 식별 — body, query, header 등 어디에서 와도 됨. */
export function getProvider(input: unknown): AIProvider {
  const v =
    typeof input === "string"
      ? input
      : (input as { provider?: string } | null)?.provider;
  return v === "claude" ? "claude" : "gemini";
}

/**
 * 제공자/키로 AI 클라이언트 생성.
 * 키 우선순위: 인자 > 환경 변수 fallback.
 */
export function getAI(provider: AIProvider, apiKey?: string): AIClient {
  if (provider === "claude") {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Anthropic API 키가 설정되지 않았습니다.");
    return new ClaudeClient(key);
  }
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API 키가 설정되지 않았습니다.");
  return new GeminiClient(key);
}

/**
 * Next.js Request 헤더에서 API 키를 꺼내는 헬퍼.
 * 클라이언트는 자기 키를 x-gemini-api-key / x-anthropic-api-key 로 전달합니다.
 */
export function getApiKeyFromHeaders(
  headers: Headers,
  provider: AIProvider
): string | undefined {
  const headerName =
    provider === "claude" ? "x-anthropic-api-key" : "x-gemini-api-key";
  return headers.get(headerName) || undefined;
}
