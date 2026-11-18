import type { ScanOutcome } from "./types";

/** 스캔 단계 결과를 한 줄로: "스캔 실행 승인됨 · 내 PC · 서비스 버전 확인" */
export function scanOutcomeLabel(o: ScanOutcome): string {
  const head =
    o.decision === "approved" ? "스캔 실행 승인됨" : o.decision === "rejected" ? "스캔 실행 거절됨 (스캔 없음)" : "첨부한 스캔 결과 분석";
  return [head, o.targets.join(", "), o.profileLabel].filter(Boolean).join(" · ");
}

/** 저장·전달된 값 검증 (형식이 맞지 않으면 버림) */
export function parseScanOutcome(v: unknown): ScanOutcome | undefined {
  const o = v as Partial<ScanOutcome> | null;
  if (!o || !["approved", "rejected", "uploaded"].includes(o.decision as string)) return undefined;
  return {
    decision: o.decision as ScanOutcome["decision"],
    targets: Array.isArray(o.targets) ? o.targets.filter((t): t is string => typeof t === "string").slice(0, 50) : [],
    ...(typeof o.profileLabel === "string" ? { profileLabel: o.profileLabel.slice(0, 40) } : {}),
  };
}
