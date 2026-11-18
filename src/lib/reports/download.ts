"use client";

import { TEAM_NAME } from "../office/roster";
import { buildReportHtml, reportFileName } from "./html";
import { renderMarkdownHtml } from "./markdown";
import type { SavedReport } from "./types";

/** 저장된 보고서를 단독 HTML 파일로 내려받습니다. */
export function downloadReport(report: SavedReport) {
  const html = buildReportHtml({ ...report, bodyHtml: renderMarkdownHtml(report.content), teamName: TEAM_NAME });
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFileName(report.title, report.approvedAt);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
