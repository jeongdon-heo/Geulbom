"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Save } from "lucide-react";
import type { AIProvider } from "@/lib/ai";
import {
  getApiKey,
  getPreferredProvider,
  setApiKey,
  setPreferredProvider,
} from "@/lib/api-keys";

export function AISettings() {
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [showClaude, setShowClaude] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProvider(getPreferredProvider());
    setGeminiKey(getApiKey("gemini") ?? "");
    setClaudeKey(getApiKey("claude") ?? "");
  }, []);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPreferredProvider(provider);
    setApiKey("gemini", geminiKey.trim());
    setApiKey("claude", claudeKey.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={onSave} className="card space-y-5">
      <p className="text-xs text-gray-500">
        키는 브라우저(localStorage)에만 저장되며, AI 요청 시 헤더로만 서버에 전달됩니다.
        서버에는 평문으로 저장되지 않습니다.
      </p>

      {/* 제공자 */}
      <div>
        <p className="label">기본 AI 제공자</p>
        <div className="flex gap-2">
          {(["gemini", "claude"] as const).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setProvider(p)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                provider === p
                  ? "border-teal bg-teal-50 text-teal-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p === "gemini" ? "Gemini 2.0 Flash" : "Claude Sonnet"}
            </button>
          ))}
        </div>
      </div>

      {/* Gemini 키 */}
      <KeyField
        id="gemini"
        label="Gemini API 키"
        hint="Google AI Studio에서 발급"
        value={geminiKey}
        onChange={setGeminiKey}
        show={showGemini}
        toggleShow={() => setShowGemini((v) => !v)}
      />

      {/* Claude 키 */}
      <KeyField
        id="claude"
        label="Anthropic API 키"
        hint="console.anthropic.com에서 발급"
        value={claudeKey}
        onChange={setClaudeKey}
        show={showClaude}
        toggleShow={() => setShowClaude((v) => !v)}
      />

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary">
          <Save className="h-4 w-4" />
          저장
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-teal-700">
            <Check className="h-4 w-4" />
            저장되었습니다
          </span>
        )}
      </div>
    </form>
  );
}

function KeyField({
  id,
  label,
  hint,
  value,
  onChange,
  show,
  toggleShow,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggleShow: () => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input pr-10 font-mono"
          placeholder={hint}
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}
