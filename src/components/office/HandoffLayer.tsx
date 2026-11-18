import { AGENT_BY_ID } from "@/lib/office/roster";
import type { Actor, Handoff } from "@/lib/office/types";

/** 팀장실 책상 위치 (평면도 기준 %) */
const LEAD_SEAT = { x: 50, y: 20 };
const seatOf = (a: Actor) => (a === "lead" ? LEAD_SEAT : AGENT_BY_ID[a].seat);
const colorOf = (a: Actor) => (a === "lead" ? "#1d1915" : AGENT_BY_ID[a].color);

/** 직원 간 업무 전달을 보낸 사람 색의 점선으로 보여주고, 최근 몇 개는 흐리게 남겨 둡니다. */
export function HandoffLayer({ handoffs }: { handoffs: Handoff[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {handoffs.map((h) => {
        const a = seatOf(h.from);
        const b = seatOf(h.to);
        return (
          <g key={h.id} className="anim-handoff">
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={colorOf(h.from)} strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" className="anim-dash"
            />
          </g>
        );
      })}
    </svg>
  );
}
