/** 결재 판단에 쓰는 보고서 근거 요약 */
export interface ReportFacts {
  /** 본문에 등장하는 서로 다른 출처 URL 수 */
  sources: number;
  /** "(확인 필요)" · "(검토 필요)" 표시 개수 */
  checks: number;
}

export function reportFacts(content: string): ReportFacts {
  const urls = new Set(
    (content.match(/https?:\/\/[^\s)<>\]"']+/g) ?? []).map((u) => u.replace(/[.,;:!?。]+$/, "").replace(/\/$/, "")),
  );
  const checks = (content.match(/\((확인|검토) 필요\)/g) ?? []).length;
  return { sources: urls.size, checks };
}
