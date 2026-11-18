import type { AgentStatus } from "@/lib/office/types";

/** 책상 + 모니터 + 사람(뒤통수 시점) 일러스트. 옷 색으로 직원을 구분합니다. */
export function Workstation({ color, status }: { color: string; status: AgentStatus | "lead" }) {
  const working = status === "working";
  const screen = working ? "#ffe3c4" : status === "error" ? "#e9b9b1" : "#8a8f97";
  return (
    <svg viewBox="0 0 120 70" className="h-auto w-[116px]" aria-hidden>
      {/* 모니터 */}
      <rect x="18" y="8" width="34" height="24" rx="2" fill="#5f646c" />
      <rect x="21" y="11" width="28" height="18" rx="1" fill={screen} className={working ? "anim-glow" : ""} />
      <rect x="32" y="32" width="6" height="6" fill="#5f646c" />
      {/* 사람 */}
      <g className={working ? "anim-typing" : ""}>
        <path d="M58 46 q0-16 16-16 q16 0 16 16 z" fill={color} />
        <circle cx="74" cy="20" r="9" fill={working ? "#c98a5e" : "#8f877d"} />
      </g>
      {/* 책상 */}
      <rect x="4" y="38" width="112" height="28" rx="3" fill="#fffefb" stroke="#d6cec1" />
      <rect x="64" y="44" width="40" height="5" rx="1.5" fill="#ebe5da" />
    </svg>
  );
}
