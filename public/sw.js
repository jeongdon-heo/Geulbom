// 글봄 서비스워커 — 모바일/웨일북 학생 접속용 (설치 가능 + 오프라인 폴백 + 정적 자원 캐싱)
// 캐시 버전을 올리면 activate 단계에서 이전 캐시가 정리됩니다.
const CACHE = "geulbom-v1";

// 앱 셸: 설치 시 미리 받아두는 최소 자원
const PRECACHE = ["/", "/offline", "/manifest.json", "/icons/icon.svg", "/icons/maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 일부 자원이 실패해도 설치는 진행되도록 개별 추가
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 외부 출처(Supabase 등)는 SW가 가로채지 않음
  if (url.origin !== self.location.origin) return;
  // API는 항상 네트워크 — 인증/동적 데이터라 캐시하면 안 됨
  if (url.pathname.startsWith("/api/")) return;

  // 페이지 이동: 네트워크 우선, 실패하면 오프라인 폴백
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // 그 외 정적 자원(_next/static, 아이콘, 폰트 등): 캐시 우선
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  try {
    return await fetch(req);
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match("/offline")) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok && ["style", "script", "image", "font"].includes(req.destination)) {
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return cached || Response.error();
  }
}
