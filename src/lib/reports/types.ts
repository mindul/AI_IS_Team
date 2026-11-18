import type { ScanOutcome } from "../scan/types";

/** 승인되어 저장된 보고서 */
export interface SavedReport {
  id: string;
  title: string;
  summary: string;
  /** 원래 팀장 지시 */
  command: string;
  /** 보고서 본문 (Markdown) */
  content: string;
  /** 결재 차수 (1 = 최초, 2 = 수정 1차 …) */
  round: number;
  /** 승인 시각 (ISO 8601) */
  approvedAt: string;
  /** 실제 AI로 만든 보고서인지, 시뮬레이션 예시인지 */
  source: "live" | "sim";
  /** 보고서 결재와 별개로, 앞서 있었던 스캔 실행 승인 결과 */
  scan?: ScanOutcome;
}

/** 목록에 보여줄 요약 정보 (본문 제외) */
export type ReportMeta = Omit<SavedReport, "content">;

export type NewReport = Omit<SavedReport, "id" | "approvedAt">;

/** 본문을 뺀 목록용 정보 */
export function toMeta(r: SavedReport): ReportMeta {
  const meta: Partial<SavedReport> = { ...r };
  delete meta.content;
  return meta as ReportMeta;
}
