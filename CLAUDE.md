# CLAUDE.md — 글봄 (GeulBom)

## 프로젝트
글봄은 초등학생 글쓰기를 AI(Gemini/Claude)로 분석하여 학생용·교사용 피드백을 생성하고 성장을 추적하는 교육 웹앱입니다.

## 기술 스택
- Next.js 14 (App Router) + Tailwind CSS
- Supabase (PostgreSQL) + Prisma ORM
- Supabase Storage (OCR 이미지)
- NextAuth.js (교사) + 커스텀 학급코드 인증 (학생)
- Google Gemini 2.5 Flash / Claude Sonnet 4.6 (교사가 선택)
- Recharts (차트)

## 전체 명세
`GEULBOM-SPEC.md`에 DB 스키마, AI 프롬프트, 페이지 구조, 비즈니스 로직, UI 가이드가 모두 정리되어 있습니다. 개발 전에 반드시 읽어주세요.

## 핵심 규칙
- DB 스키마는 `prisma/schema.prisma`를 따릅니다. 임의로 변경하지 마세요.
- AI 프롬프트는 `lib/prompts.ts`의 빌더 함수를 사용합니다. 하드코딩하지 마세요.
- AI 제공자(Gemini/Claude) 전환은 `lib/ai.ts`를 통합니다.
- 피드백은 교사 승인(APPROVED) 전까지 학생에게 보이지 않습니다.
- 학생 API는 APPROVED 상태인 피드백만 반환합니다.
- 루브릭은 동적입니다. 영역 개수와 배점이 템플릿마다 다를 수 있습니다.

## 코드 컨벤션
- TypeScript 사용
- 한국어 주석 사용 (코드는 영어, UI 텍스트/주석은 한국어)
- 컴포넌트: PascalCase, 유틸: camelCase
- API 응답: `{ success: boolean, data?: any, error?: string }`
- 에러 메시지: 한국어

## 개발 순서
Phase 1(MVP)부터 시작: 프로젝트 세팅 → DB → 인증 → 학급·학생 → 과제 → 제출 → AI 분석 → 승인 → 학생 피드백 확인

## 실행 명령어
```bash
npm run dev        # 개발 서버
npx prisma db push # DB 마이그레이션
npm run db:seed    # 시드 데이터
npx prisma studio  # DB 브라우저
```
