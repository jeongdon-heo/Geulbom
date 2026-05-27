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
      <body>
        <ServiceWorkerRegister />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
