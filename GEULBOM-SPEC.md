# 글봄 (GeulBom) — 프로젝트 명세서

> 글쓰기 AI 분석 · 피드백 · 성장 추적 교육 웹앱
> Claude Code 개발용 전체 명세

---

## 1. 프로젝트 개요

**글봄**은 초등학생의 글쓰기를 AI(Gemini/Claude)로 분석하여 학생용·교사용 피드백을 생성하고, 학생의 글쓰기 성장을 추적하는 교육 웹앱입니다. NugaBom(누가봄) 시리즈의 일환으로, "글을 보고, 성장의 봄을 맞이한다"는 의미입니다.

### 핵심 가치
- 학생: 따뜻한 피드백으로 글쓰기 동기부여 + 성장 시각화
- 교사: AI가 분석을 자동화하되, 교사가 최종 검토·승인하는 워크플로우

### 사용자 역할
- **교사**: 로그인(이메일+비밀번호) → 학급 관리, 과제 출제, AI 피드백 검토/수정/승인, 성장 리포트
- **학생**: 학급코드+출석번호+PIN으로 접속 → 글쓰기 제출, 피드백 확인, 나의 성장 확인

---

## 2. 기술 스택

| 항목 | 기술 |
|---|---|
| 프레임워크 | **Next.js 14** (App Router) |
| 스타일링 | **Tailwind CSS** |
| DB | **Supabase** (PostgreSQL) + **Prisma** ORM |
| 파일 저장 | **Supabase Storage** (OCR 이미지) |
| AI | **Gemini 2.0 Flash** / **Claude Sonnet** (교사가 선택) |
| 인증 | **NextAuth.js** (교사) + 커스텀 학급코드 인증 (학생) |
| 차트 | **Recharts** |
| 배포 | **Vercel** |
| PWA | 서비스워커 (모바일 학생 접속용) |

### 설치 의존성
```
next react react-dom
tailwindcss postcss autoprefixer
@prisma/client prisma
next-auth
@google/generative-ai
@anthropic-ai/sdk
recharts
nanoid bcryptjs zod
lucide-react
```

---

## 3. DB 스키마 (Prisma)

아래 스키마를 `prisma/schema.prisma`에 그대로 사용합니다.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── 인증 ──

model InviteCode {
  id        String    @id @default(uuid())
  code      String    @unique @db.VarChar(8)
  isActive  Boolean   @default(true) @map("is_active")
  expiresAt DateTime  @map("expires_at")
  usedBy    String?   @map("used_by")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")
  teacher   Teacher?  @relation(fields: [usedBy], references: [id])
  @@map("invite_codes")
}

model Teacher {
  id        String   @id @default(uuid())
  email     String   @unique @db.VarChar(255)
  password  String   @db.VarChar(255)
  name      String   @db.VarChar(50)
  school    String?  @db.VarChar(100)
  role      String   @default("teacher") @db.VarChar(20)
  createdAt DateTime @default(now()) @map("created_at")
  classes        Class[]
  inviteCodes    InviteCode[]
  rubricTemplates RubricTemplate[]
  @@map("teachers")
}

// ── 학급·학생 ──

model Class {
  id        String   @id @default(uuid())
  teacherId String   @map("teacher_id")
  name      String   @db.VarChar(50)
  year      Int
  classCode String   @unique @map("class_code") @db.VarChar(10)
  createdAt DateTime @default(now()) @map("created_at")
  teacher        Teacher          @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  students       Student[]
  assignments    Assignment[]
  yearendReports YearendReport[]
  @@unique([teacherId, year])
  @@map("classes")
}

model Student {
  id        String   @id @default(uuid())
  classId   String   @map("class_id")
  number    Int
  name      String   @db.VarChar(50)
  pin       String?  @db.VarChar(10)
  createdAt DateTime @default(now()) @map("created_at")
  class          Class           @relation(fields: [classId], references: [id], onDelete: Cascade)
  submissions    Submission[]
  yearendReports YearendReport[]
  @@unique([classId, number])
  @@map("students")
}

// ── 루브릭 ──

model RubricTemplate {
  id           String   @id @default(uuid())
  teacherId    String   @map("teacher_id")
  name         String   @db.VarChar(100)
  totalScore   Int      @default(100) @map("total_score")
  areas        Json     @db.JsonB
  scoringGuide Json?    @map("scoring_guide") @db.JsonB
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  teacher     Teacher      @relation(fields: [teacherId], references: [id])
  assignments Assignment[]
  @@map("rubric_templates")
}

// ── 과제 ──

enum AssignmentType {
  REGULAR
  IRREGULAR
}

enum Frequency {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
}

model Assignment {
  id               String         @id @default(uuid())
  classId          String         @map("class_id")
  rubricTemplateId String         @map("rubric_template_id")
  title            String         @db.VarChar(200)
  description      String?        @db.Text
  type             AssignmentType
  writingType      String         @db.VarChar(30)
  minChars         Int?           @map("min_chars")
  recommendedChars Int?           @map("recommended_chars")
  frequency        Frequency?
  dayOfWeek        Int?           @map("day_of_week")
  startDate        DateTime?      @map("start_date")
  endDate          DateTime?      @map("end_date")
  deadline         DateTime?
  autoApprove      Boolean        @default(false) @map("auto_approve")
  showScoreToStudent Boolean      @default(true) @map("show_score_to_student")
  aiPromptNote     String?        @map("ai_prompt_note") @db.Text
  isActive         Boolean        @default(true) @map("is_active")
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")
  class          Class          @relation(fields: [classId], references: [id], onDelete: Cascade)
  rubricTemplate RubricTemplate @relation(fields: [rubricTemplateId], references: [id])
  rounds         AssignmentRound[]
  @@map("assignments")
}

model AssignmentRound {
  id           String   @id @default(uuid())
  assignmentId String   @map("assignment_id")
  roundNumber  Int      @map("round_number")
  title        String?  @db.VarChar(200)
  deadline     DateTime
  isOpen       Boolean  @default(true) @map("is_open")
  createdAt    DateTime @default(now()) @map("created_at")
  assignment  Assignment   @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  submissions Submission[]
  @@unique([assignmentId, roundNumber])
  @@map("assignment_rounds")
}

// ── 제출 ──

enum InputMethod {
  TYPED
  STUDENT_OCR
  TEACHER_OCR
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
}

model Submission {
  id                String           @id @default(uuid())
  studentId         String           @map("student_id")
  assignmentRoundId String           @map("assignment_round_id")
  text              String           @db.Text
  charCount         Int              @map("char_count")
  inputMethod       InputMethod      @map("input_method")
  status            SubmissionStatus @default(DRAFT)
  submittedAt       DateTime?        @map("submitted_at")
  createdAt         DateTime         @default(now()) @map("created_at")
  updatedAt         DateTime         @updatedAt @map("updated_at")
  student         Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  assignmentRound AssignmentRound @relation(fields: [assignmentRoundId], references: [id], onDelete: Cascade)
  ocrRecord       OcrRecord?
  feedback        Feedback?
  @@unique([studentId, assignmentRoundId])
  @@map("submissions")
}

// ── OCR ──

model OcrRecord {
  id           String   @id @default(uuid())
  submissionId String   @unique @map("submission_id")
  imageUrl     String   @map("image_url") @db.Text
  ocrRawText   String   @map("ocr_raw_text") @db.Text
  editedText   String   @map("edited_text") @db.Text
  confidence   Float
  aiProvider   String   @map("ai_provider") @db.VarChar(10)
  segments     Json     @db.JsonB
  corrections  Json     @default("[]") @db.JsonB
  createdAt    DateTime @default(now()) @map("created_at")
  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  @@map("ocr_records")
}

// ── 피드백 ──

enum ApprovalStatus {
  PENDING
  APPROVED
}

model Feedback {
  id                   String         @id @default(uuid())
  submissionId         String         @unique @map("submission_id")
  aiProvider           String         @map("ai_provider") @db.VarChar(10)
  scores               Json           @db.JsonB
  totalScore           Int            @map("total_score")
  feedbackStudent      Json           @map("feedback_student") @db.JsonB
  feedbackTeacher      Json           @map("feedback_teacher") @db.JsonB
  approvalStatus       ApprovalStatus @default(PENDING) @map("approval_status")
  teacherComment       String?        @map("teacher_comment") @db.Text
  teacherEditedStudent Json?          @map("teacher_edited_student") @db.JsonB
  approvedAt           DateTime?      @map("approved_at")
  createdAt            DateTime       @default(now()) @map("created_at")
  submission Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  @@index([approvalStatus])
  @@map("feedbacks")
}

// ── 학년말 보고서 ──

model YearendReport {
  id            String   @id @default(uuid())
  studentId     String   @map("student_id")
  classId       String   @map("class_id")
  year          Int
  reportTeacher Json     @map("report_teacher") @db.JsonB
  reportStudent Json     @map("report_student") @db.JsonB
  generatedAt   DateTime @default(now()) @map("generated_at")
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  class   Class   @relation(fields: [classId], references: [id], onDelete: Cascade)
  @@unique([studentId, year])
  @@map("yearend_reports")
}
```

---

## 4. 기본 루브릭 데이터

시드 데이터로 넣을 기본 루브릭 템플릿:

```json
{
  "name": "일기 기본형",
  "totalScore": 100,
  "areas": [
    { "key": "content", "name": "내용", "maxScore": 20, "description": "주제에 맞는 내용을 풍부하게 썼는가" },
    { "key": "structure", "name": "구성", "maxScore": 20, "description": "글의 흐름이 자연스럽고, 문단이 구분되어 있는가" },
    { "key": "expression", "name": "표현", "maxScore": 20, "description": "다양한 어휘와 비유, 생생한 묘사를 사용했는가" },
    { "key": "grammar", "name": "맞춤법·문법", "maxScore": 20, "description": "맞춤법, 띄어쓰기, 문법이 정확한가" },
    { "key": "volume", "name": "분량", "maxScore": 20, "description": "최소 글자 수를 충족하고, 내용에 비해 적절한 양인가" }
  ],
  "scoringGuide": {
    "content": {
      "high": "18~20: 주제를 깊이 있게 다루고, 자신의 경험·생각·느낌이 구체적으로 드러남",
      "mid": "13~17: 주제에 맞는 내용이나, 구체적 사례나 깊이가 부족함",
      "low": "~12: 주제와 관련 없는 내용이 많거나, 내용이 매우 빈약함"
    },
    "structure": {
      "high": "18~20: 처음-중간-끝이 뚜렷하고, 문장 간 연결이 자연스러움",
      "mid": "13~17: 흐름은 있으나 문단 구분이 없거나, 연결이 어색한 부분이 있음",
      "low": "~12: 나열식으로 시간순 사건만 나열, 글의 구조가 없음"
    },
    "expression": {
      "high": "18~20: 비유, 의성어/의태어, 감각적 묘사가 2회 이상, 다양한 어휘 사용",
      "mid": "13~17: 표현 시도는 있으나 단조로움. '재미있었다', '좋았다' 등 반복",
      "low": "~12: 거의 모든 문장이 '~했다'로 끝남, 반복 표현만 사용"
    },
    "grammar": {
      "high": "18~20: 맞춤법·띄어쓰기 오류 0~1개",
      "mid": "13~17: 오류 2~5개, 대체로 읽는 데 지장 없음",
      "low": "~12: 오류 6개 이상, 읽기에 불편을 줌"
    },
    "volume": {
      "high": "18~20: 최소 기준의 150% 이상, 내용에 비해 충분한 양",
      "mid": "13~17: 최소 기준 충족~130%, 조금 더 쓸 수 있었음",
      "low": "~12: 최소 기준 미달, 또는 의미 없는 반복으로 양만 채움"
    }
  }
}
```

---

## 5. 페이지 라우팅 구조

```
app/
├── (auth)/
│   ├── login/page.tsx           # 교사 로그인
│   └── register/page.tsx        # 교사 회원가입 (초대코드)
├── student/
│   ├── login/page.tsx           # 학생 로그인 (학급코드+번호+PIN)
│   ├── home/page.tsx            # 학생 홈 (과제 목록, 새 피드백 알림)
│   ├── write/[roundId]/page.tsx # 글쓰기 (직접입력/OCR)
│   ├── feedback/[id]/page.tsx   # 피드백 보기 (원문+피드백)
│   └── growth/page.tsx          # 나의 성장 (그래프, 뱃지, 글 모아보기)
├── dashboard/                   # 교사 대시보드
│   ├── page.tsx                 # 메인 대시보드 (통계, 진행중 과제, 검토 대기)
│   ├── assignments/
│   │   ├── page.tsx             # 과제 목록
│   │   ├── new/page.tsx         # 새 과제 생성
│   │   └── [id]/page.tsx        # 과제 상세 (제출 현황)
│   ├── feedback/
│   │   ├── page.tsx             # 피드백 검토 목록 (PENDING/APPROVED 필터)
│   │   └── [id]/page.tsx        # 개별 피드백 검토/승인
│   ├── students/
│   │   ├── page.tsx             # 학생 목록
│   │   └── [id]/page.tsx        # 학생 포트폴리오 (타임라인+필터)
│   ├── growth/page.tsx          # 성장 분석 대시보드 (개인별/학급 전체)
│   ├── ocr/page.tsx             # 교사 OCR 업로드 (개별/일괄)
│   ├── rubrics/page.tsx         # 루브릭 템플릿 관리
│   └── settings/page.tsx        # 학급 설정, AI 키, 학생 관리
├── admin/page.tsx               # 관리자 (초대코드 생성)
├── api/
│   ├── auth/[...nextauth]/      # NextAuth
│   ├── student-auth/            # 학생 학급코드 인증 API
│   ├── classes/                 # 학급 CRUD
│   ├── students/                # 학생 CRUD
│   ├── assignments/             # 과제 CRUD + 회차 자동 생성
│   ├── submissions/             # 제출 CRUD
│   ├── analyze/
│   │   ├── ocr/                 # OCR API (Gemini/Claude Vision)
│   │   └── feedback/            # 글쓰기 분석 + 피드백 생성
│   ├── feedback/                # 피드백 승인/수정
│   ├── rubrics/                 # 루브릭 CRUD
│   └── reports/yearend/         # 학년말 보고서 생성
└── layout.tsx
```

---

## 6. AI 프롬프트 요약

AI 프롬프트는 `lib/prompts.ts`에 빌더 함수로 구현합니다.

### 6-1. OCR 프롬프트 (`buildOcrPrompt`)
- 초등학생 손글씨 인식 전문가 역할
- 맞춤법 틀린 것도 그대로 변환
- JSON 응답: `{ fullText, segments: [{text, confidence}], overallConfidence, lowConfidenceWords: [{original, candidates, confidence, reason}] }`

### 6-2. 분석 프롬프트 (`buildAnalysisPrompt`)
- 루브릭 영역을 동적으로 주입 (areas, scoringGuide)
- 이전 회차 점수 비교 컨텍스트 포함
- 교사 커스텀 지시(aiPromptNote) 반영
- JSON 응답: `{ scores, totalScore, feedbackTeacher: {areaAnalysis, grammarErrors, repetitions, overall, comparisonWithPrevious, teachingDirection}, feedbackStudent: {praise, suggestion, encouragement} }`
- 채점 원칙: 초등 4학년 기준, 극단적 점수 지양

### 6-3. 학년말 보고서 프롬프트 (`buildYearendReportPrompt`)
- 전체 글 이력과 영역별 시작→최종 점수를 포함
- JSON 응답: `{ reportTeacher: {summary, areaGrowth, milestones, bestSentences, nextYearSuggestions}, reportStudent: {growthStory, bestMoments, improvements, nextYearMission, teacherMessage} }`

### 6-4. AI 제공자 추상화 (`lib/ai.ts`)
```typescript
// Gemini와 Claude를 동일 인터페이스로 호출
export type AIProvider = "gemini" | "claude";
export function getProvider(input: unknown): AIProvider;
export function getAI(provider: AIProvider);
```

API 키는 localStorage에 저장 (`lib/api-keys.ts`). 서버에서는 요청 헤더(`x-gemini-api-key`, `x-anthropic-api-key`)로 전달.

---

## 7. 핵심 비즈니스 로직

### 7-1. 과제 회차 자동 생성
정기 과제(REGULAR)가 생성되면, startDate~endDate 범위에서 frequency와 dayOfWeek에 따라 AssignmentRound를 자동 생성합니다.
```
예: 주간 일기, WEEKLY, dayOfWeek=5(금), 3/7~7/18
→ 20개 AssignmentRound 자동 생성 (#1~#20, 각각 해당 금요일 마감)
```

### 7-2. 피드백 승인 워크플로우
1. 학생 제출 (Submission.status = SUBMITTED)
2. AI 분석 실행 → Feedback 생성 (approvalStatus = PENDING)
3. 교사가 검토 → 수정/코멘트 추가 → 승인 (approvalStatus = APPROVED, approvedAt 기록)
4. 학생에게 피드백 공개 (학생 API에서 APPROVED인 것만 반환)
5. autoApprove=true인 과제는 2→4 자동 진행

### 7-3. 학생 인증
- 학급코드(classCode) + 출석번호(number) + PIN으로 인증
- JWT 또는 세션 쿠키로 학생 세션 관리
- NextAuth와 별도 경로 (`/api/student-auth`)

### 7-4. OCR 흐름
1. 이미지 업로드 → Supabase Storage 저장 → URL 획득
2. AI Vision API로 OCR 실행 → segments + confidence 반환
3. 사용자(학생 또는 교사)가 수정 → corrections 기록
4. 최종 텍스트를 Submission.text에 저장, inputMethod 기록

### 7-5. 성장 대시보드
- 학생별: 모든 Feedback의 scores를 시간순 조회 → Recharts 꺾은선 그래프
- 학급별: 전체 학생 평균 점수 추이, 영역별 강점/약점 분포
- AI 인사이트: 가장 성장한 영역, 정체 영역을 자동 계산하여 코멘트 생성

### 7-6. 성장 뱃지 (학생 동기부여)
- 꾸준히 글쟁이: 제출 10편 달성
- 쑥쑥 성장: 첫 글 대비 총점 +10점
- 표현의 달인: 표현 영역 15점 이상
- 맞춤법 마스터: 맞춤법 영역 18점 이상
- (교사가 커스텀 뱃지 추가 가능)

---

## 8. UI 디자인 가이드

### 색상 체계
- 메인: Teal (#1D9E75) — 로고, 주요 버튼, 성공 상태
- 영역별 색상:
  - 내용: Teal (#1D9E75)
  - 구성: Blue (#378ADD)
  - 표현: Purple (#7F77DD)
  - 맞춤법: Coral (#D85A30)
  - 분량: Amber (#BA7517)
- 배경: 따뜻한 뉴트럴 (#fafaf6, #f5f4ee)

### 교사 화면 (데스크탑 중심)
- 5개 탭: 대시보드, 과제관리, 피드백, 포트폴리오, 성장분석
- 학급코드 표시, 학생 수/미제출/검토 대기 요약 카드
- 피드백 카드: 학생 원문 → AI 점수 → 학생용 칭찬/제안 → 교사용 분석 → 승인 버튼

### 학생 화면 (모바일 중심)
- 하단 네비게이션: 홈, 글쓰기, 피드백, 성장
- 홈: 해야 할 과제 + 새 피드백 알림
- 글쓰기: 직접 입력 또는 사진 촬영, 글자 수 카운터, 임시저장
- 피드백: 점수 + 원문 + 선생님 피드백 (잘한 점 → 제안 → 응원 → 선생님 직접 코멘트) + 맞춤법 고치기
- 나의 성장: 점수 추이 그래프, AI 성장 분석, 뱃지, 글 모아보기

### 교사 OCR 업로드
- 개별 모드: 학생/과제 선택 → 촬영/업로드 → 인식 → 수정 → 저장
- 일괄 모드: 과제 선택 → 여러 장 업로드 → 학생 매칭 → 일괄 인식 → 개별 확인/수정

---

## 9. 환경 변수

```env
DATABASE_URL="supabase postgresql URL"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="xxx"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="openssl rand -base64 32"
GEMINI_API_KEY="Google AI Studio에서 발급"
ANTHROPIC_API_KEY="(선택, 서버용 기본키)"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="관리자비밀번호"
ADMIN_NAME="관리자이름"
```

---

## 10. 개발 우선순위

### Phase 1: 핵심 루프 (MVP)
1. 프로젝트 세팅 (Next.js + Tailwind + Prisma + Supabase)
2. DB 마이그레이션 + 시드 (관리자 + 기본 루브릭)
3. 교사 인증 (로그인/회원가입)
4. 학급·학생 관리 (CRUD)
5. 과제 생성 (정기/비정기 + 루브릭 선택)
6. **학생 글 제출** (직접 타이핑)
7. **AI 분석 + 피드백 생성** (Gemini/Claude 선택)
8. **교사 피드백 검토·승인**
9. **학생 피드백 확인** (원문 + 피드백 함께)

### Phase 2: 확장 기능
10. 학생 학급코드 인증
11. OCR (학생 촬영 + 교사 개별/일괄 업로드)
12. 성장 대시보드 (Recharts 그래프)
13. 학생 나의 성장 (뱃지, 글 모아보기)
14. 포트폴리오 (학생별 타임라인)

### Phase 3: 완성
15. 학년말 종합 보고서 + PDF 내보내기
16. 루브릭 커스터마이징 UI
17. PWA 설정
18. Vercel 배포

---

## 11. 참고 파일

이 명세와 함께 다음 파일들을 프로젝트에 포함합니다:
- `prisma/schema.prisma` — 위 스키마 그대로
- `lib/prompts.ts` — AI 프롬프트 빌더 함수 3종 + 기본 루브릭 데이터
- `lib/ai.ts` — AI 제공자 추상화
- `lib/api-keys.ts` — 클라이언트 API 키 관리
