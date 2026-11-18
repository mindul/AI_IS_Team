import { AGENTS } from "./roster";
import type { AgentId, AgentStatus, LogEntry, OfficeAction, OfficeState } from "./types";

/** 평면도에 남겨 둘 업무 전달선 수 (최근 것만 흐리게 유지) */
const MAX_HANDOFFS = 4;

function allStatuses(status: AgentStatus): Record<AgentId, AgentStatus> {
  return Object.fromEntries(AGENTS.map((a) => [a.id, status])) as Record<AgentId, AgentStatus>;
}

export const INITIAL_STATE: OfficeState = {
  phase: "idle",
  missionId: null,
  command: null,
  statuses: allStatuses("idle"),
  logs: [],
  usage: { tokens: 0, searches: 0, costKrw: 0 },
  quota: null,
  approval: null,
  scanRequest: null,
  handoffs: [],
  tasks: {},
};

export function formatTime(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addLog(state: OfficeState, at: number, entry: Omit<LogEntry, "id" | "time">): LogEntry[] {
  return [...state.logs, { id: `${at}-${state.logs.length}`, time: formatTime(at), ...entry }];
}

export function officeReducer(state: OfficeState, { event, at }: OfficeAction): OfficeState {
  switch (event.type) {
    case "mission_started":
      return {
        ...state,
        phase: "running",
        missionId: event.missionId,
        command: event.command,
        statuses: allStatuses("idle"),
        approval: null,
        scanRequest: null,
        handoffs: [],
        tasks: { chief: event.command },
        logs: addLog(state, at, { from: "lead", to: "chief", text: event.command }),
      };

    case "agent_status":
      return { ...state, statuses: { ...state.statuses, [event.agentId]: event.status } };

    case "handoff":
      return {
        ...state,
        handoffs: [
          ...state.handoffs,
          { id: `${at}-${state.logs.length}`, from: event.from, to: event.to },
        ].slice(-MAX_HANDOFFS),
        // 비서실장·팀장에게 가는 전달은 "보고"이므로 맡은 업무를 바꾸지 않습니다.
        tasks:
          event.to === "lead" || event.to === "chief" ? state.tasks : { ...state.tasks, [event.to]: event.summary },
        logs: addLog(state, at, { from: event.from, to: event.to, text: event.summary }),
      };

    case "log":
      return { ...state, logs: addLog(state, at, { from: event.from, text: event.text }) };

    case "search":
      return {
        ...state,
        usage: { ...state.usage, searches: state.usage.searches + 1 },
        logs: addLog(state, at, { from: event.agentId, text: `웹 검색: ${event.query}` }),
      };

    case "usage":
      return {
        ...state,
        usage: {
          ...state.usage,
          tokens: state.usage.tokens + event.tokens,
          costKrw: state.usage.costKrw + event.costKrw,
        },
      };

    case "quota":
      return { ...state, quota: event.quota };

    case "approval_requested":
      return {
        ...state,
        phase: "awaiting_approval",
        approval: event.approval,
        logs: addLog(state, at, { from: "chief", to: "lead", kind: "report", text: `보고서 결재 요청: ${event.approval.title}` }),
      };

    case "approval_resolved": {
      if (!state.approval) return state;
      if (event.decision === "approved") {
        const statuses = Object.fromEntries(
          Object.entries(state.statuses).map(([id, s]) => [id, s === "idle" ? "idle" : "done"]),
        ) as Record<AgentId, AgentStatus>;
        return {
          ...state,
          phase: "idle",
          approval: null,
          statuses,
          logs: addLog(state, at, { from: "lead", kind: "report", text: `보고서 승인 — ${state.approval.title}` }),
        };
      }
      const comment = event.comment?.trim();
      return {
        ...state,
        phase: "running",
        approval: null,
        logs: addLog(state, at, {
          from: "lead",
          to: "chief",
          kind: "report",
          text: comment ? `보고서 반려 — ${comment}` : "보고서 반려",
        }),
      };
    }

    case "scan_approval_requested":
      return {
        ...state,
        phase: "awaiting_scan",
        scanRequest: event.scan,
        statuses: { ...state.statuses, chief: "review" },
        logs: addLog(state, at, {
          from: "chief",
          to: "lead",
          kind: "scan",
          text: `스캔 실행 승인 요청: ${event.scan.targets.map((t) => t.name).join(", ")} — ${event.scan.profileLabel}`,
        }),
      };

    case "scan_resolved":
      if (!state.scanRequest) return state;
      return {
        ...state,
        phase: "running",
        scanRequest: null,
        statuses: { ...state.statuses, chief: "working" },
        logs: addLog(state, at, {
          from: "lead",
          to: "chief",
          kind: "scan",
          text: event.decision === "approved" ? "스캔 실행 승인" : "스캔 실행 거절 — 스캔 없이 진행",
        }),
      };

    case "logs_cleared":
      return { ...state, logs: [] };

    case "mission_failed": {
      // 작업 중이던 직원은 오류로 표시하고, 지시를 다시 받을 수 있게 대기 상태로 돌립니다.
      const statuses = Object.fromEntries(
        Object.entries(state.statuses).map(([id, s]) => [id, s === "working" || s === "review" ? "error" : s]),
      ) as Record<AgentId, AgentStatus>;
      if (event.agentId) statuses[event.agentId] = "error";
      return {
        ...state,
        phase: "idle",
        approval: null,
        scanRequest: null,
        statuses,
        logs: addLog(state, at, { from: event.agentId ?? "chief", text: `업무 중단 — ${event.reason}` }),
      };
    }
  }
}
