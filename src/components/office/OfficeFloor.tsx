"use client";

import { useEffect } from "react";
import { AGENT_BY_ID, AGENTS, LEAD_LABEL, TIER_LABEL } from "@/lib/office/roster";
import type { AgentId, AgentProfile, AgentStatus, Handoff, OfficePhase } from "@/lib/office/types";
import { AgentMark } from "../AgentMark";
import { IconClose } from "../icons";
import { StatusBadge } from "../StatusBadge";
import { btn } from "../ui";
import { HandoffLayer } from "./HandoffLayer";
import { Workstation } from "./Workstation";

const PHASE_TEXT: Record<OfficePhase, string> = {
  idle: "지시를 기다리는 중",
  running: "업무 진행 중",
  awaiting_scan: "팀장 스캔 실행 승인 대기 중",
  awaiting_approval: "팀장 보고서 결재 대기 중",
};

function Desk({
  agent,
  status,
  selected,
  onSelect,
}: {
  agent: AgentProfile;
  status: AgentStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${agent.name}, ${status === "idle" ? "대기" : status} — 담당 업무 보기`}
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl px-2 pt-1 pb-2 transition-colors ${
        selected ? "bg-white shadow-[0_6px_20px_-10px_rgb(29_25_21/0.35)] ring-2 ring-ink/80" : "hover:bg-white/70"
      }`}
      style={{ left: `${agent.seat.x}%`, top: `${agent.seat.y}%` }}
    >
      <Workstation color={agent.color} status={status} />
      <span className="flex items-center gap-1.5 text-sm leading-tight font-bold whitespace-nowrap">
        <AgentMark actor={agent.id} />
        {agent.name}
      </span>
      <StatusBadge status={status} />
    </button>
  );
}

/** 선택한 직원의 담당 업무와 현재 맡은 일 (평면도 안에 떠 있는 카드, 화면을 가리지 않음) */
function AgentDetail({
  agent,
  status,
  currentTask,
  onClose,
  onShowLog,
}: {
  agent: AgentProfile;
  status: AgentStatus;
  currentTask: string | null;
  onClose: () => void;
  onShowLog: () => void;
}) {
  return (
    <aside
      aria-label={`${agent.name} 상세`}
      // 선택한 책상의 반대편 위쪽에 띄워 그 책상을 가리지 않게 합니다.
      className={`absolute top-3 z-20 w-[300px] ${agent.seat.x > 50 ? "left-3" : "right-3"} rounded-xl border border-line bg-white p-4 shadow-[0_16px_40px_-20px_rgb(29_25_21/0.45)]`}
    >
      <div className="flex items-start gap-2.5">
        <AgentMark actor={agent.id} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">{agent.name}</h3>
          <p className="text-xs text-muted">{TIER_LABEL[agent.tier]}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="-m-1 rounded-md p-1 text-muted hover:bg-sunken hover:text-ink">
          <IconClose />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[13px]">
        <StatusBadge status={status} />
        <span className="min-w-0 truncate text-ink-2">{currentTask ?? "맡은 업무 없음"}</span>
      </div>
      <h4 className="mt-3 text-xs font-bold text-muted">전문 분야</h4>
      <ul className="mt-1 space-y-0.5 text-[13px] leading-snug text-ink-2">
        {agent.expertise.map((e) => (
          <li key={e} className="flex gap-1.5">
            <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full" style={{ backgroundColor: agent.color }} />
            {e}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onShowLog} className={`${btn.secondary} mt-3 w-full`}>
        이 직원의 업무 로그만 보기
      </button>
    </aside>
  );
}

export function OfficeFloor({
  statuses,
  phase,
  handoffs,
  selected,
  currentTasks,
  onSelect,
  onShowLog,
}: {
  statuses: Record<AgentId, AgentStatus>;
  phase: OfficePhase;
  handoffs: Handoff[];
  selected: AgentId | null;
  /** 직원별 가장 최근에 받은 업무 */
  currentTasks: Partial<Record<AgentId, string>>;
  onSelect: (id: AgentId | null) => void;
  onShowLog: (id: AgentId) => void;
}) {
  // Esc로 상세 카드 닫기
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onSelect(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onSelect]);

  const working = Object.values(statuses).filter((s) => s === "working").length;

  return (
    <section
      aria-labelledby="floor-heading"
      className="relative h-full min-h-[540px] overflow-hidden rounded-xl border border-line bg-floor"
      style={{ backgroundImage: "radial-gradient(rgb(29 25 21 / 0.07) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
    >
      <header className="absolute top-4 left-5 z-10">
        <h2 id="floor-heading" className="text-sm font-bold">
          팀 사무실
        </h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${phase === "running" ? "anim-glow bg-accent" : phase === "idle" ? "bg-line-strong" : "bg-accent"}`}
          />
          {PHASE_TEXT[phase]}
          {phase === "running" && working > 0 && ` · ${working}명 작업 중`}
        </p>
      </header>

      {/* 팀장실 */}
      <div className="absolute top-[4%] left-1/2 flex h-[30%] w-[26%] min-w-[160px] -translate-x-1/2 flex-col items-center justify-end rounded-md border border-line-strong bg-sunken/70 pb-3">
        <span className="absolute top-2 left-2.5 text-xs font-semibold text-muted">팀장실</span>
        <Workstation color="#1d1915" status="lead" />
        <span className="mt-1 text-sm font-bold">{LEAD_LABEL}</span>
        <span
          className={`mt-1 rounded border px-1.5 py-px text-xs font-semibold ${
            phase === "awaiting_approval"
              ? "border-accent bg-accent text-white"
              : phase === "awaiting_scan"
                ? "border-[#2d4f7c] bg-[#2d4f7c] text-white"
                : "border-line-strong bg-white text-ink-2"
          }`}
        >
          {phase === "awaiting_approval" ? "보고서 결재 필요" : phase === "awaiting_scan" ? "스캔 승인 필요" : "결재 없음"}
        </span>
      </div>

      {/* 비서실장 구역 */}
      <div
        aria-hidden
        className="absolute top-[60%] left-1/2 aspect-square w-[34%] min-w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e3c7b1]"
        style={{ background: "radial-gradient(circle, #f4e2d3 0%, #f6ece2 58%, transparent 72%)" }}
      />

      <HandoffLayer handoffs={handoffs} />

      {AGENTS.map((agent) => (
        <Desk
          key={agent.id}
          agent={agent}
          status={statuses[agent.id]}
          selected={selected === agent.id}
          onSelect={() => onSelect(selected === agent.id ? null : agent.id)}
        />
      ))}

      {selected && (
        <AgentDetail
          agent={AGENT_BY_ID[selected]}
          status={statuses[selected]}
          currentTask={currentTasks[selected] ?? null}
          onClose={() => onSelect(null)}
          onShowLog={() => onShowLog(selected)}
        />
      )}
    </section>
  );
}
