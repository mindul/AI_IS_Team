/** 보고서의 "## 요약" 내용을 결재 패널에 보여줄 한 줄로 줄입니다. */
export function summaryOf(report: string): string {
  const m = report.match(/##\s*요약[^\n]*\n+([\s\S]*?)(?=\n#{1,2}\s|$)/);
  const body = (m?.[1] ?? report).replace(/^[-*>\s]+/gm, "").replace(/\s+/g, " ").trim();
  return body.length > 120 ? `${body.slice(0, 120)}…` : body;
}
