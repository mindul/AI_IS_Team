import { describe, expect, it } from "vitest";
import { buildReportHtml, reportFileName } from "./html";

const base = {
  title: "랜섬웨어 <대응> 보고서",
  bodyHtml: "<h1>본문</h1>",
  command: 'A&B "점검"',
  approvedAt: "2026-11-18T11:00:00.000Z",
  round: 2,
  source: "live" as const,
  teamName: "AI 정보보안팀",
};

describe("buildReportHtml", () => {
  it("단독 HTML 문서를 만들고 메타 정보는 이스케이프한다", () => {
    const html = buildReportHtml(base);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<title>랜섬웨어 &lt;대응&gt; 보고서</title>");
    expect(html).toContain("팀장 지시: A&amp;B &quot;점검&quot;");
    expect(html).toContain("보고서 승인");
    expect(html).toContain("수정 1차");
    expect(html).toContain("<h1>본문</h1>");
    expect(html).not.toContain("시뮬레이션 예시");
  });

  it("스캔 실행 승인 결과를 보고서 승인과 따로 적는다", () => {
    const html = buildReportHtml({ ...base, scan: { decision: "approved", targets: ["내 PC"], profileLabel: "주요 포트 확인" } });
    expect(html).toContain("스캔 실행 승인됨 · 내 PC · 주요 포트 확인");
  });

  it("시뮬레이션 보고서는 표시를 붙인다", () => {
    expect(buildReportHtml({ ...base, source: "sim", round: 1 })).toContain("시뮬레이션 예시");
  });
});

describe("reportFileName", () => {
  it("날짜를 붙이고 파일명에 못 쓰는 문자를 정리한다", () => {
    // 로컬 시각으로 만든 값이라 시간대와 무관하게 같은 날짜가 나와야 함
    const local = new Date(2026, 10, 18, 0, 30).toISOString();
    expect(reportFileName('보고서: A/B "점검"?', local)).toBe("2026-11-18_보고서 A B 점검.html");
    expect(reportFileName("   ", local)).toBe("2026-11-18_보고서.html");
  });
});
