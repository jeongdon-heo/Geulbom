import { customAlphabet } from "nanoid";

// ============================================================
// 코드 생성기 모음
// ============================================================

// 학급코드: 학생이 직접 타이핑하는 코드 → 헷갈리는 글자 제외(0,O,1,I,L)
// 형식: "GB-XXXXXX" (총 9자, prefix 포함)
const classCodeBody = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);

export function generateClassCode(): string {
  return `GB-${classCodeBody()}`;
}

// 초대코드(관리자→교사 가입): 8자 영숫자
const inviteCodeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export function generateInviteCode(): string {
  return inviteCodeGen();
}
