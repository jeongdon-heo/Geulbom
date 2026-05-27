"use client";

import { useEffect } from "react";

/**
 * 서비스워커(/sw.js)를 등록하는 클라이언트 전용 컴포넌트.
 * 개발 모드에서는 캐시로 인한 혼선을 막기 위해 등록하지 않습니다(프로덕션 빌드에서만 동작).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 등록 실패는 앱 동작에 영향을 주지 않으므로 조용히 무시
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
