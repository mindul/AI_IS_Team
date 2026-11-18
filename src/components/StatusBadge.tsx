import { STATUS_LABEL } from "@/lib/office/roster";
import type { AgentStatus } from "@/lib/office/types";

/** 상태는 색만이 아니라 글자로도 전달합니다. 모든 조합 대비 5.9:1 이상. */
const STYLE: Record<AgentStatus, string> = {
  idle: "border-line-strong bg-white text-ink-2",
  working: "border-accent-line bg-accent-soft text-accent-strong",
  review: "border-scan-line bg-scan-soft text-scan",
  done: "border-success-line bg-success-soft text-success",
  error: "border-danger-line bg-danger-soft text-danger",
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
