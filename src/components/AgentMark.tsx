import { AGENT_BY_ID, LEAD_LABEL } from "@/lib/office/roster";
import type { Actor } from "@/lib/office/types";

/** 직원 이니셜 원형 표식. 색과 글자 두 가지로 누구인지 알려줍니다. */
export function AgentMark({ actor, size = "sm" }: { actor: Actor; size?: "sm" | "md" }) {
  const isLead = actor === "lead";
  const color = isLead ? "#1d1915" : AGENT_BY_ID[actor].color;
  const label = isLead ? "팀" : AGENT_BY_ID[actor].initial;
  return (
    <span
      aria-hidden
      title={isLead ? LEAD_LABEL : AGENT_BY_ID[actor].name}
      style={{ backgroundColor: color }}
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${
        size === "sm" ? "size-[18px] text-[10px]" : "size-6 text-xs"
      }`}
    >
      {label}
    </span>
  );
}
