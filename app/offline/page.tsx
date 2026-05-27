import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오프라인 — 글봄",
};

/**
 * 오프라인 폴백 페이지.
 * 서비스워커가 네트워크 연결 실패 시(req.mode === "navigate") 이 페이지를 반환합니다.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <div className="mb-4 text-6xl" aria-hidden>
        🌱
      </div>
      <h1 className="text-xl font-bold text-teal-700">인터넷에 연결되어 있지 않아요</h1>
      <p className="mt-2 max-w-xs text-sm text-gray-500">
        네트워크 연결을 확인한 뒤 다시 시도해 주세요. 연결되면 자동으로 이어집니다.
      </p>
    </main>
  );
}
