import { STATUS_LABEL } from "@/lib/office/roster";
import type { AgentStatus } from "@/lib/office/types";

/** 상태는 색만이 아니라 글자로도 전달합니다. 모든 조합 대비 5.9:1 이상. */
const STYLE: Record<AgentStatus, string> = {
  idle: "border-line-strong bg-white text-ink-2",
  working: "border-[#d9a98a] bg-accent-soft text-[#8a4119]",
  review: "border-[#a9bcd6] bg-[#e3eaf4] text-[#2d4f7c]",
  done: "border-[#adc49c] bg-[#e3eedb] text-[#35602a]",
  error: "border-[#d7a39b] bg-[#f6dfdb] text-[#8f2f25]",
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-xs font-semibold whitespace-nowrap ${STYLE[status]}`}
    >
      {status === "working" && <span className="anim-glow size-1.5 rounded-full bg-accent" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
