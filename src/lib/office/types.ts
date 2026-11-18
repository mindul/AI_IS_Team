import type { ScanOutcome, ScanRequest } from "../scan/types";

export type AgentId =
  | "chief"
  | "threat" // 위협정보 분석가
  | "awareness" // 보안교육 담당
  | "compliance" // 컴플라이언스 담당
  | "vuln" // 취약점 점검 담당
  | "incident"; // 침해대응 담당

/** 로그에서 직원 외에 등장하는 주체 */
export type Actor = AgentId | "lead";

export type AgentStatus = "idle" | "working" | "review" | "done" | "error";

export type ModelTier = "top" | "standard";

export interface AgentProfile {
  id: AgentId;
  name: string;
  /** 직원 카드에 보이는 한 줄 설명 */
  summary: string;
  /** 3단계에서 직원별 지시문(system prompt)에 들어갈 전문 분야 */
  expertise: string[];
  tier: ModelTier;
  /** 사무실 평면도 안 좌석 위치 (%) */
  seat: { x: number; y: number };
  /** 직원 고유 색 (아바타·이니셜·로그 표식). 패널 위 글자로 써도 4.5:1 이상 */
  color: string;
  /** 이니셜 한 글자 (색 외의 구분 수단) */
  initial: string;
  /** 평면도·로그에서 쓰는 짧은 이름 */
  shortName: string;
}

export interface LogEntry {
  id: string;
  time: string; // "HH:MM"
  from: Actor;
  to?: Actor;
  text: string;
  /** 팀장 결정 기록 구분: 스캔 실행 승인 / 보고서 결재 */
  kind?: "scan" | "report";
}

export interface Usage {
  tokens: number;
  searches: number;
  costKrw: number;
}

/** Claude 구독 요금제 사용량 (Claude Code가 알려주는 사용률) */
export interface Quota {
  /** 5시간 단위 사용률 0~1 */
  fiveHour?: number;
  /** 7일 단위 사용률 0~1 */
  sevenDay?: number;
  /** 5시간 한도 초기화 시각 (epoch ms) */
  resetsAt?: number;
  status: string;
}

export interface Approval {
  id: string;
  title: string;
  summary: string;
  /** 최종 보고서 본문 (Markdown) */
  content: string;
  /** 결재 차수 (1 = 최초, 2 = 수정 1차 …) */
  round: number;
  /** 이 보고서에 참여한 직원 (비서실장 제외) */
  contributors?: AgentId[];
  /** 이 PC에서만 붙이는 부록 (점검 대상 별칭 대응표 등). AI에게 보내지 않습니다. */
  appendix?: string;
  /** 이 보고서에 앞서 있었던 스캔 실행 승인 결과 */
  scan?: ScanOutcome;
}

/** 사무실 평면도에 그려지는 업무 전달 화살표 */
export interface Handoff {
  id: string;
  from: Actor;
  to: Actor;
}

export type OfficePhase = "idle" | "running" | "awaiting_scan" | "awaiting_approval";

export interface OfficeState {
  phase: OfficePhase;
  missionId: string | null;
  /** 현재 업무의 원래 지시문 (반려 후 수정 요청 시 사용) */
  command: string | null;
  statuses: Record<AgentId, AgentStatus>;
  logs: LogEntry[];
  usage: Usage;
  /** 구독 요금제로 실행할 때만 채워집니다 */
  quota: Quota | null;
  approval: Approval | null;
  /** 팀장 승인을 기다리는 시스템 점검(스캔) 요청 */
  scanRequest: ScanRequest | null;
  handoffs: Handoff[];
  /** 직원별 가장 최근에 받은 업무 (평면도 상세 카드용) */
  tasks: Partial<Record<AgentId, string>>;
}

/**
 * 사무실에서 일어나는 모든 일. 2단계 시뮬레이션과 3단계 실제 AI가 같은 이벤트를 발행합니다.
 */
export type OfficeEvent =
  | { type: "mission_started"; missionId: string; command: string }
  | { type: "agent_status"; agentId: AgentId; status: AgentStatus }
  | { type: "handoff"; from: Actor; to: Actor; summary: string }
  | { type: "log"; from: Actor; text: string }
  | { type: "search"; agentId: AgentId; query: string }
  | { type: "usage"; tokens: number; costKrw: number }
  | { type: "quota"; quota: Quota }
  | { type: "approval_requested"; approval: Approval }
  | { type: "approval_resolved"; decision: "approved" | "rejected"; comment?: string }
  | { type: "mission_failed"; reason: string; agentId?: AgentId }
  /** 시스템 점검(스캔)은 반드시 팀장 승인을 받은 뒤 실행합니다 */
  | { type: "scan_approval_requested"; scan: ScanRequest }
  | { type: "scan_resolved"; decision: "approved" | "rejected" }
  /** 화면의 업무 로그만 비웁니다 (팀장이 초기화 버튼을 누름) */
  | { type: "logs_cleared" };

/** 이벤트 + 발생 시각(epoch ms). 리듀서를 순수 함수로 유지하기 위해 시각을 함께 넘깁니다. */
export interface OfficeAction {
  event: OfficeEvent;
  at: number;
}
