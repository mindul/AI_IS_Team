import type { ScanOutcome } from "@/lib/scan/types";
import { IconCheck } from "../icons";

type StepState = { text: string; tone: "now-scan" | "now-report" | "done" | "later" };

const DOT: Record<StepState["tone"], string> = {
  "now-scan": "bg-[#2d4f7c] text-white",
  "now-report": "bg-accent text-white",
  done: "bg-[#35602a] text-white",
  later: "border border-line-strong text-muted",
};

function Step({ n, label, state }: { n: number; label: string; state: StepState }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={`grid size-[18px] place-items-center rounded-full text-[11px] font-bold ${DOT[state.tone]}`}>
        {state.tone === "done" ? <IconCheck className="size-3" /> : n}
      </span>
      <span className={`font-semibold ${state.tone === "later" ? "text-muted" : "text-ink"}`}>{label}</span>
      <span className="text-muted">{state.text}</span>
    </li>
  );
}

/**
 * 스캔이 포함된 업무의 두 단계 결정을 구분해 보여줍니다.
 * ① 스캔 실행 승인 (실제 시스템을 건드려도 되는가) → ② 보고서 결재 (결과물을 확정하는가)
 */
export function ApprovalSteps({ current, scan }: { current: "scan" | "report"; scan?: ScanOutcome }) {
  const scanState: StepState =
    current === "scan"
      ? { text: "지금 결정", tone: "now-scan" }
      : scan?.decision === "approved"
        ? { text: "승인됨", tone: "done" }
        : scan?.decision === "rejected"
          ? { text: "거절됨", tone: "done" }
          : { text: "첨부 결과 사용", tone: "done" };
  const reportState: StepState =
    current === "report" ? { text: "지금 결정", tone: "now-report" } : { text: "스캔 뒤 요청", tone: "later" };

  return (
    <ol aria-label="결정 단계" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line pb-2.5 text-xs">
      <Step n={1} label="스캔 실행 승인" state={scanState} />
      <li aria-hidden className="text-line-strong">
        —
      </li>
      <Step n={2} label="보고서 결재" state={reportState} />
    </ol>
  );
}
