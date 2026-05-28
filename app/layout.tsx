import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "글봄 (GeulBom) — 글쓰기 AI 분석·피드백",
  description:
    "초등학생의 글쓰기를 AI로 분석하고, 교사가 검토·승인하는 따뜻한 피드백 플랫폼",
  manifest: "/manifest.json",
  applicationName: "글봄",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg" }],
  },
  // iOS 홈 화면 추가 시 전체화면 앱처럼 동작
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "글봄",
  },
  // apple-mobile-web-app-capable 의 표준 대체 메타(콘솔 deprecation 경고 해소)
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1D9E75",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard 공식 dynamic-subset CSS — 사용된 글자만 받아 가볍고, 깨진 단일 woff2 경로 문제 해소 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
