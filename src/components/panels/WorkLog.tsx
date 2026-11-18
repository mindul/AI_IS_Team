"use client";

import { useEffect, useRef } from "react";
import { AGENT_BY_ID, actorName } from "@/lib/office/roster";
import type { AgentId, LogEntry, Quota, Usage } from "@/lib/office/types";
import { AgentMark } from "../AgentMark";
import { IconClose } from "../icons";

const nf = new Intl.NumberFormat("ko-KR");
const pct = (v?: number) => (v === undefined ? "–" : `${Math.round(v * 100)}%`);

export type Billing = "subscription" | "api" | "sim";

/** 사용량 표시: 구독은 요금제 사용률, API는 추정 금액, 시뮬레이션은 비용 없음 */
function usageLabel(usage: Usage, billing: Billing, quota: Quota | null): string {
  if (billing === "sim") return "시뮬레이션 · 비용 없음";
  const base = `토큰 ${nf.format(usage.tokens)} · 검색 ${usage.searches}회`;
  if (billing === "api") return `${base} · 약 ${nf.format(Math.round(usage.costKrw))}원`;
  if (!quota) return `${base} · 구독 요금제`;
  const reset = quota.resetsAt
    ? ` (${new Date(quota.resetsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })} 초기화)`
    : "";
  return `${base} · Pro 5시간 ${pct(quota.fiveHour)}${reset} · 주간 ${pct(quota.sevenDay)}`;
}

export function WorkLog({
  logs,
  usage,
  quota,
  billing,
  filter,
  onClearFilter,
  onClear,
  examples,
  onPickExample,
}: {
  logs: LogEntry[];
  usage: Usage;
  quota: Quota | null;
  billing: Billing;
  /** 이 직원이 보내거나 받은 기록만 보기 */
  filter: AgentId | null;
  onClearFilter: () => void;
  onClear: () => void;
  /** 로그가 비어 있을 때 보여줄 예시 지시 */
  examples?: string[];
  onPickExample: (text: string) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  /** 사용자가 맨 아래를 보고 있는지. 위로 올려 읽는 중이면 새 로그가 와도 끌어내리지 않습니다. */
  const atBottomRef = useRef(true);
  const shown = filter ? logs.filter((l) => l.from === filter || l.to === filter) : logs;

  // 필터를 바꾸면 새 목록의 맨 아래부터 보여줍니다. (아래 스크롤 효과보다 먼저 실행되도록 앞에 둠)
  useEffect(() => {
    atBottomRef.current = true;
  }, [filter]);

  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown.length, filter]);

  return (
    <section aria-labelledby="worklog-heading" className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-panel">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 id="worklog-heading" className="text-[15px] font-bold">
          업무 로그
        </h2>
        {filter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-white py-0.5 pr-1.5 pl-1 text-xs font-semibold"
            aria-label={`${AGENT_BY_ID[filter].name} 필터 해제`}
          >
            <AgentMark actor={filter} />
            {AGENT_BY_ID[filter].shortName}만
            <IconClose className="size-3 text-muted" />
          </button>
        )}
        <span className="tabular ml-auto truncate text-xs text-muted">{usageLabel(usage, billing, quota)}</span>
        <button
          type="button"
          onClick={onClear}
          disabled={logs.length === 0}
          title="화면의 업무 로그를 지웁니다. 진행 중인 업무와 결재에는 영향이 없습니다."
          className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-muted hover:bg-sunken hover:text-ink disabled:opacity-40"
        >
          로그 지우기
        </button>
      </header>
      <ol
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        aria-label="업무 기록" className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3 text-sm">
        {shown.length === 0 && (
          <li className="py-8 text-center leading-relaxed text-muted">
            {filter ? (
              "이 직원의 기록이 아직 없습니다."
            ) : (
              <>
                지시를 내리면 팀원들의 업무 기록이 여기에 쌓입니다.
                <br />
                사무실의 책상을 누르면 직원별 담당 업무를 볼 수 있습니다.
                {examples && examples.length > 0 && (
                  <span className="mx-auto mt-6 block max-w-[440px] text-left">
                    <span className="block text-xs font-bold text-ink-2">이렇게 지시해 보세요</span>
                    <span className="mt-2 flex flex-col gap-1.5">
                      {examples.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => onPickExample(ex)}
                          className="rounded-lg border border-line bg-white px-3 py-2 text-left text-[13px] leading-snug text-ink-2 hover:border-line-strong hover:text-ink"
                        >
                          {ex}
                        </button>
                      ))}
                    </span>
                  </span>
                )}
              </>
            )}
          </li>
        )}
        {shown.map((log) => (
          <li key={log.id} className="grid grid-cols-[2.75rem_auto_1fr] items-start gap-2 leading-snug">
            <time className="tabular pt-px text-xs text-muted">{log.time}</time>
            <AgentMark actor={log.from} />
            <p className="min-w-0 break-words text-ink-2">
              <b className="font-semibold text-ink">{actorName(log.from)}</b>
              {log.to && (
                <>
                  <span className="text-muted"> → </span>
                  <b className="font-semibold text-ink">{actorName(log.to)}</b>
                </>
              )}{" "}
              {log.kind && (
                <span
                  className={`mr-1 inline-block rounded px-1 py-px align-[1px] text-[11px] font-bold ${
                    log.kind === "scan" ? "bg-scan-soft text-scan" : "bg-accent-soft text-accent-strong"
                  }`}
                >
                  {log.kind === "scan" ? "스캔 승인" : "보고서 결재"}
                </span>
              )}
              {log.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
