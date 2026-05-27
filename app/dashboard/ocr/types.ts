// 교사 OCR 페이지 공용 타입

export interface OcrStudent {
  id: string;
  number: number;
  name: string;
}

export interface OcrRound {
  id: string;
  roundNumber: number;
  title: string | null;
  deadline: string; // ISO
}

export interface OcrAssignment {
  id: string;
  title: string;
  writingType: string;
  minChars: number | null;
  rounds: OcrRound[];
}

export interface OcrClass {
  id: string;
  name: string;
  year: number;
  students: OcrStudent[];
  assignments: OcrAssignment[];
}

export interface OcrPageData {
  classes: OcrClass[];
}
