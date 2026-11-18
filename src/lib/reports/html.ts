/** 다운로드용 단독 HTML 문서를 만듭니다. 인터넷 연결 없이도 열리도록 스타일을 문서 안에 넣습니다. */

import { scanOutcomeLabel } from "../scan/outcome";
import type { ScanOutcome } from "../scan/types";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** 앱 화면과 같은 색 (src/app/globals.css의 @theme 값과 맞춰 둡니다) */
const C = {
  paper: "#f1eee8",
  panel: "#fbfaf7",
  sunken: "#ebe6dd",
  line: "#e0dbd1",
  ink: "#1d1915",
  ink2: "#3b342c",
  muted: "#5f574c",
  accentText: "#9a4a1f",
  accentSoft: "#f6e4d6",
  accentStrong: "#8a4119",
};

const STYLE = `
:root { color-scheme: light; }
body { margin: 0; background: ${C.paper}; color: ${C.ink}; font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; word-break: keep-all; }
main { max-width: 820px; margin: 32px auto; background: ${C.panel}; border: 1px solid ${C.line}; border-radius: 12px; padding: 40px 48px; }
.meta { font-size: 13px; color: ${C.muted}; border-bottom: 1px solid ${C.line}; padding-bottom: 12px; margin-bottom: 24px; line-height: 1.7; }
.meta b { color: ${C.ink}; }
.badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 4px; background: ${C.accentSoft}; color: ${C.accentStrong}; margin-right: 6px; }
.report { font-size: 15px; line-height: 1.75; }
.report h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 1rem; }
.report h2 { font-size: 1.15rem; font-weight: 700; margin: 1.75rem 0 0.6rem; padding-bottom: 0.3rem; border-bottom: 1px solid ${C.line}; }
.report h3 { font-size: 1rem; font-weight: 700; margin: 1.25rem 0 0.4rem; }
.report p, .report ul, .report ol, .report table, .report blockquote { margin: 0.6rem 0; }
.report ul, .report ol { padding-left: 1.4rem; }
.report li { margin: 0.2rem 0; }
.report a { color: ${C.accentText}; text-underline-offset: 2px; word-break: break-all; }
.report strong { font-weight: 700; }
.report blockquote { background: ${C.sunken}; border-radius: 6px; padding: 0.5rem 0.9rem; color: ${C.ink2}; }
.report code { font-family: "SF Mono", "D2Coding", ui-monospace, monospace; font-size: 0.85em; background: ${C.sunken}; padding: 0.1rem 0.3rem; border-radius: 4px; }
.report table { width: 100%; border-collapse: collapse; font-size: 14px; }
.report th, .report td { border: 1px solid ${C.line}; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
.report th { background: ${C.sunken}; font-weight: 700; }
.report hr { border: 0; border-top: 1px solid ${C.line}; margin: 1.5rem 0; }
footer { max-width: 820px; margin: 0 auto 32px; font-size: 12px; color: ${C.muted}; text-align: center; }
@media print {
  body { background: #fff; }
  main { border: 0; margin: 0; padding: 0; max-width: none; }
  footer { margin: 16px 0 0; }
  .report h2, .report h3 { break-after: avoid; }
  .report table, .report blockquote { break-inside: avoid; }
}`;


export interface ReportHtmlInput {
  title: string;
  /** react-markdown이 렌더링한 본문 HTML (원본 HTML 태그는 이스케이프된 상태) */
  bodyHtml: string;
  command: string;
  approvedAt: string;
  round: number;
  source: "live" | "sim";
  teamName: string;
  scan?: ScanOutcome;
}

export function buildReportHtml(r: ReportHtmlInput): string {
  const approved = new Date(r.approvedAt).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" });
  const roundLabel = r.round > 1 ? ` · 수정 ${r.round - 1}차` : "";
  const scanLine = r.scan ? `<br>${escapeHtml(scanOutcomeLabel(r.scan))}` : "";
  const badge = r.source === "sim" ? '<span class="badge">시뮬레이션 예시</span>' : "";
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(r.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="meta">
${badge}<b>${escapeHtml(r.teamName)}</b> · 보고서 승인 ${escapeHtml(approved)}${roundLabel}<br>
팀장 지시: ${escapeHtml(r.command)}${scanLine}
</div>
<article class="report">
${r.bodyHtml}
</article>
</main>
<footer>AI가 작성하고 팀장이 승인한 문서입니다 · 수치·법령·출처는 담당자 확인이 필요합니다</footer>
</body>
</html>
`;
}

/** 파일 이름에 쓸 수 없는 문자를 정리합니다: 2026-11-18_보고서제목.html */
export function reportFileName(title: string, approvedAt: string): string {
  const d = new Date(approvedAt);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // 이 PC 시간대 기준 날짜
  const safe = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${date}_${safe || "보고서"}.html`;
}
