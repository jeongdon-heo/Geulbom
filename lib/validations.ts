import { z } from "zod";

// ============================================================
// 입력 검증 스키마 (Zod)
// 라우트 핸들러 / 서버 액션에서 공용으로 사용합니다.
// ============================================================

// 교사 회원가입
export const registerSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(72, "비밀번호가 너무 깁니다."),
  name: z.string().min(1, "이름을 입력해주세요.").max(50),
  school: z.string().max(100).optional().nullable(),
  inviteCode: z
    .string()
    .length(8, "초대코드는 8자입니다.")
    .regex(/^[A-Z0-9]+$/, "초대코드 형식이 올바르지 않습니다."),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// 관리자 초대코드 발급
export const createInviteCodeSchema = z.object({
  count: z.number().int().min(1).max(50).default(1),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});
export type CreateInviteCodeInput = z.infer<typeof createInviteCodeSchema>;

// 학급 생성
export const createClassSchema = z.object({
  name: z.string().min(1, "학급 이름을 입력해주세요.").max(50),
  year: z
    .number()
    .int()
    .min(2020, "연도가 올바르지 않습니다.")
    .max(2100),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const updateClassSchema = z.object({
  name: z.string().min(1).max(50).optional(),
});
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

// 학생 생성 (단건)
export const createStudentSchema = z.object({
  classId: z.string().uuid(),
  number: z.number().int().min(1).max(99),
  name: z.string().min(1).max(50),
  pin: z
    .string()
    .min(4, "PIN은 4자 이상입니다.")
    .max(10)
    .regex(/^\d+$/, "PIN은 숫자만 가능합니다.")
    .optional()
    .nullable(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

// 학생 일괄 추가 (한 학급에 여러 명)
export const bulkCreateStudentsSchema = z.object({
  classId: z.string().uuid(),
  students: z
    .array(
      z.object({
        number: z.number().int().min(1).max(99),
        name: z.string().min(1).max(50),
        pin: z
          .string()
          .max(10)
          .regex(/^\d*$/, "PIN은 숫자만 가능합니다.")
          .optional()
          .nullable(),
      })
    )
    .min(1)
    .max(50),
});
export type BulkCreateStudentsInput = z.infer<typeof bulkCreateStudentsSchema>;

export const updateStudentSchema = z.object({
  number: z.number().int().min(1).max(99).optional(),
  name: z.string().min(1).max(50).optional(),
  pin: z
    .string()
    .max(10)
    .regex(/^\d*$/, "PIN은 숫자만 가능합니다.")
    .optional()
    .nullable(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

// ── 루브릭 ──

// 루브릭 영역 1개
export const rubricAreaSchema = z.object({
  key: z
    .string()
    .min(1, "영역 키를 입력해주세요.")
    .max(40)
    .regex(/^[a-zA-Z0-9_]+$/, "영역 키는 영문/숫자/_만 가능합니다."),
  name: z.string().min(1, "영역 이름을 입력해주세요.").max(40),
  maxScore: z
    .number()
    .int()
    .min(1, "배점은 1점 이상이어야 합니다.")
    .max(100, "배점이 너무 큽니다."),
  description: z.string().min(1, "영역 설명을 입력해주세요.").max(500),
});

// 채점 기준 (영역 키 → 상/중/하)
export const scoringGuideEntrySchema = z.object({
  high: z.string().max(500),
  mid: z.string().max(500),
  low: z.string().max(500),
});

// 루브릭 생성/수정 공용 본문 (전체 교체 방식)
const rubricBodySchema = z
  .object({
    name: z.string().min(1, "루브릭 이름을 입력해주세요.").max(100),
    areas: z
      .array(rubricAreaSchema)
      .min(1, "영역을 최소 1개 추가해주세요.")
      .max(10, "영역은 최대 10개까지 가능합니다."),
    scoringGuide: z.record(scoringGuideEntrySchema).optional().nullable(),
  })
  .refine(
    (v) => new Set(v.areas.map((a) => a.key)).size === v.areas.length,
    { message: "영역 키가 중복되었습니다." }
  );

export const createRubricSchema = rubricBodySchema;
export type CreateRubricInput = z.infer<typeof createRubricSchema>;

export const updateRubricSchema = rubricBodySchema;
export type UpdateRubricInput = z.infer<typeof updateRubricSchema>;

// 과제 생성
export const createAssignmentSchema = z
  .object({
    classId: z.string().uuid(),
    rubricTemplateId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    type: z.enum(["REGULAR", "IRREGULAR"]),
    writingType: z.string().min(1).max(30), // "일기", "독후감", "주장하는 글" 등
    minChars: z.number().int().min(0).max(10000).optional().nullable(),
    recommendedChars: z.number().int().min(0).max(10000).optional().nullable(),
    autoApprove: z.boolean().default(false),
    showScoreToStudent: z.boolean().default(true),
    aiPromptNote: z.string().max(2000).optional().nullable(),
    // 정기 과제 전용
    frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).optional().nullable(),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(), // 0=일 ~ 6=토
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    // 비정기 전용
    deadline: z.string().datetime().optional().nullable(),
  })
  .refine(
    (v) =>
      v.type === "IRREGULAR"
        ? !!v.deadline
        : !!(v.frequency && v.startDate && v.endDate),
    {
      message: "정기 과제는 frequency/startDate/endDate, 비정기 과제는 deadline이 필요합니다.",
    }
  )
  .refine(
    (v) =>
      v.type === "REGULAR" && (v.frequency === "WEEKLY" || v.frequency === "BIWEEKLY")
        ? v.dayOfWeek !== null && v.dayOfWeek !== undefined
        : true,
    { message: "주간/격주 과제는 요일(dayOfWeek)이 필요합니다." }
  );
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

// 제출 (학생/교사 공용)
export const ocrPayloadSchema = z.object({
  imageUrl: z.string().min(1),
  ocrRawText: z.string(),
  confidence: z.number().min(0).max(1),
  aiProvider: z.enum(["gemini", "claude"]),
  segments: z
    .array(
      z.object({
        text: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .default([]),
  corrections: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
      })
    )
    .default([]),
});
export type OcrPayload = z.infer<typeof ocrPayloadSchema>;

export const submissionUpsertSchema = z.object({
  assignmentRoundId: z.string().uuid(),
  text: z.string().max(10000, "글이 너무 깁니다."),
  inputMethod: z.enum(["TYPED", "STUDENT_OCR", "TEACHER_OCR"]).default("TYPED"),
  action: z.enum(["SAVE_DRAFT", "SUBMIT"]),
  ocr: ocrPayloadSchema.optional().nullable(),
});
export type SubmissionUpsertInput = z.infer<typeof submissionUpsertSchema>;

// 교사 대리 제출 (TEACHER_OCR)
export const teacherSubmissionUpsertSchema = z.object({
  assignmentRoundId: z.string().uuid(),
  studentId: z.string().uuid(),
  text: z.string().max(10000, "글이 너무 깁니다."),
  action: z.enum(["SAVE_DRAFT", "SUBMIT"]),
  ocr: ocrPayloadSchema.optional().nullable(),
});
export type TeacherSubmissionUpsertInput = z.infer<typeof teacherSubmissionUpsertSchema>;

// 피드백 수정/승인 (교사)
export const updateFeedbackSchema = z.object({
  teacherComment: z.string().max(2000).optional().nullable(),
  teacherEditedStudent: z
    .object({
      praise: z.string(),
      suggestion: z.string(),
      encouragement: z.string(),
    })
    .optional()
    .nullable(),
  approve: z.boolean().optional(), // true면 APPROVED로 전환
});
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
