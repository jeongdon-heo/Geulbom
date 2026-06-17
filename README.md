# 글봄 (GeulBom) 🌱

초등학생의 글쓰기를 AI(Gemini / Claude)로 분석하여 **학생용·교사용 피드백**을 생성하고 성장을 추적하는 교육 웹앱입니다. 교사가 검토·승인한 피드백만 학생에게 보입니다.

## 기술 스택

- **Next.js 14** (App Router) + **Tailwind CSS**
- **Supabase** (PostgreSQL) + **Prisma ORM**
- **Supabase Storage** (OCR 이미지)
- **NextAuth.js** (교사) + 커스텀 인증 (학생)
- **Google Gemini 2.5 Flash** / **Claude Sonnet 4.6** (교사가 선택)
- **Recharts** (성장 차트), **PWA** (서비스워커 · 오프라인 폴백 · 설치)

## 주요 기능

- 교사/학생 인증, 학급·학생·과제·제출 관리
- AI 글쓰기 분석 → 교사 승인 게이팅(APPROVED 전까지 학생 비노출)
- 손글씨 OCR, 성장 대시보드, 포트폴리오, 학년말 보고서(브라우저 인쇄 PDF)
- 동적 루브릭 커스터마이징(영역 개수·배점 가변)

---

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # 값을 채워 넣으세요
npm run db:push              # Supabase에 스키마 적용
npm run db:seed              # 관리자 계정 + 기본 루브릭 시드
npm run dev                  # http://localhost:3000
```

> PWA 서비스워커는 **프로덕션 빌드에서만** 등록됩니다(개발 중 캐시 혼선 방지).
> 설치/오프라인을 확인하려면 `npm run build && npm run start`로 실행하세요.

### 그 외 명령어

```bash
npm run db:studio            # Prisma Studio (DB 브라우저)
npx dotenv -e .env.local -- tsx scripts/make-invite.ts   # 교사 가입용 초대코드 발급
```

---

## 환경 변수

`.env.example`를 복사해 채웁니다. Vercel 배포 시에는 동일 키를 **Project → Settings → Environment Variables**에 등록하세요.

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | Supabase **pooler** 연결 URL (포트 6543, `?pgbouncer=true`) — 런타임용 |
| `DIRECT_URL` | Supabase **직접** 연결 URL (포트 5432) — 마이그레이션용 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage 업로드용 (서버 전용, **절대 클라이언트 노출 금지**) |
| `SUPABASE_OCR_BUCKET` | OCR 이미지 버킷명 (private, 사전 생성 필요) |
| `NEXTAUTH_URL` | 배포 도메인 (예: `https://geulbom.vercel.app`) — **프로덕션 필수** |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32`로 생성 |
| `GEMINI_API_KEY` | 서버 fallback Gemini 키 (선택) |
| `ANTHROPIC_API_KEY` | 서버 fallback Claude 키 (선택) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | 시드 시 생성되는 관리자 계정 |

---

## Vercel 배포

1. **저장소 연결** — Vercel에서 `New Project` → 이 GitHub 저장소 import. 프레임워크는 Next.js로 자동 인식됩니다.
2. **환경 변수 등록** — 위 표의 모든 키를 등록. `NEXTAUTH_URL`은 배포될 도메인으로 설정하세요.
3. **빌드** — 별도 설정 불필요.
   - `npm install` 시 `postinstall: prisma generate`가 실행되어 Prisma Client가 생성됩니다(이게 없으면 Vercel 캐시로 인해 빌드가 실패함).
   - 이어서 `npm run build`(`next build`)가 실행됩니다.
4. **DB 준비(최초 1회, 로컬에서)** — Vercel 빌드는 마이그레이션을 돌리지 않습니다. 로컬에서 `.env.local`을 운영 DB로 채운 뒤 `npm run db:push` + `npm run db:seed`를 한 번 실행하세요.
5. **Supabase Storage** — `ocr-images` 버킷(private, 이미지 MIME, 용량 제한)을 콘솔에서 미리 만들어 두세요.

> 런타임은 서버리스 함수이므로 반드시 **pooler URL(`DATABASE_URL`)** 을 사용해야 연결 수가 폭주하지 않습니다.

---

## 프로젝트 구조

```
app/          App Router 페이지 + API 라우트
  (auth)/     교사 로그인·회원가입
  admin/      관리자(초대코드)
  dashboard/  교사 화면
  student/    학생 화면
  offline/    PWA 오프라인 폴백
lib/          AI(ai.ts) · 프롬프트 · 인증 · 검증 · 성장 계산
prisma/       schema.prisma · seed.ts
public/       manifest.json · sw.js · 아이콘
scripts/      검증/운영 스크립트(verify-*, make-invite)
```

자세한 명세(DB 스키마, AI 프롬프트, 페이지 구조, 비즈니스 로직, UI 가이드)는 [`GEULBOM-SPEC.md`](./GEULBOM-SPEC.md)를 참고하세요.
