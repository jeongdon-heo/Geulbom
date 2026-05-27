"use client";

import { Printer } from "lucide-react";

export function ReportPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
    >
      <Printer className="h-3.5 w-3.5" />
      PDF 저장
    </button>
  );
}
