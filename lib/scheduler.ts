// ============================================================
// 정기 과제 회차 자동 생성
// SPEC §7-1: REGULAR 과제는 startDate~endDate 사이에서
// frequency / dayOfWeek 에 따라 AssignmentRound를 생성합니다.
//
// 마감일 정책:
//   - WEEKLY/BIWEEKLY: 해당 주의 dayOfWeek 23:59
//   - DAILY: 매일 23:59
//   - MONTHLY: 해당 달의 마지막 날 23:59 (간단화)
// ============================================================

import type { Frequency } from "@prisma/client";

export interface RoundPlan {
  roundNumber: number;
  deadline: Date; // 마감 시각 (해당 일의 23:59:59 KST 기준)
}

/** 해당 일자의 끝(23:59:59.999)으로 정규화 */
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** start 이상이면서 dayOfWeek 와 일치하는 첫 날짜 */
function firstOnOrAfter(start: Date, dayOfWeek: number): Date {
  const diff = (dayOfWeek - start.getDay() + 7) % 7;
  return addDays(start, diff);
}

/** 해당 달의 마지막 날 */
function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

export function planRounds(opts: {
  frequency: Frequency;
  dayOfWeek?: number | null;
  startDate: Date;
  endDate: Date;
}): RoundPlan[] {
  const { frequency, startDate, endDate } = opts;
  if (startDate > endDate) return [];

  const rounds: Date[] = [];

  if (frequency === "DAILY") {
    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
      rounds.push(new Date(d));
    }
  } else if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    const dow = opts.dayOfWeek ?? 1; // 기본 월요일
    const step = frequency === "WEEKLY" ? 7 : 14;
    let d = firstOnOrAfter(startDate, dow);
    while (d <= endDate) {
      rounds.push(new Date(d));
      d = addDays(d, step);
    }
  } else if (frequency === "MONTHLY") {
    // 시작월부터 종료월까지, 각 월의 마지막 날을 마감으로
    let y = startDate.getFullYear();
    let m = startDate.getMonth();
    while (true) {
      const last = lastDayOfMonth(y, m);
      if (last < startDate) {
        // 시작일 이후의 첫 마감만 채택
      } else if (last > endDate) {
        break;
      } else {
        rounds.push(last);
      }
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      if (new Date(y, m, 1) > endDate) break;
    }
  }

  return rounds.map((d, i) => ({
    roundNumber: i + 1,
    deadline: endOfDay(d),
  }));
}
