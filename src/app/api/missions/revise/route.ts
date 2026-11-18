import { runRevision } from "@/lib/ai/orchestrator";
import { backendStatus } from "@/lib/ai/selectBackend";
import { eventStream } from "@/lib/ai/sse";
import { AGENT_BY_ID } from "@/lib/office/roster";
import type { AgentId } from "@/lib/office/types";
import { parseScanOutcome } from "@/lib/scan/outcome";

/** 반려된 보고서를 의견에 맞게 고쳐 다시 결재 요청합니다. */
export async function POST(request: Request) {
  const status = await backendStatus();
  if (!status.live) return Response.json({ error: status.hint ?? "실제 AI를 사용할 수 없습니다" }, { status: 503 });

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string) => (typeof b?.[k] === "string" ? (b[k] as string) : "");
  const round = typeof b?.round === "number" && Number.isInteger(b.round) ? b.round : 0;
  const input = {
    command: str("command").trim(),
    title: str("title"),
    report: str("report"),
    comment: str("comment").slice(0, 1000),
    missionId: str("missionId"),
    round,
    appendix: str("appendix").slice(0, 50_000) || undefined,
    scan: parseScanOutcome(b?.scan),
    contributors: Array.isArray(b?.contributors)
      ? (b.contributors.filter((a) => typeof a === "string" && a in AGENT_BY_ID) as AgentId[])
      : undefined,
  };
  if (!input.command || !input.report || !input.missionId || round < 2 || input.report.length > 200_000)
    return Response.json({ error: "수정 요청 정보가 올바르지 않습니다" }, { status: 400 });

  return eventStream((emit, signal) => runRevision(input, emit, signal), request.signal);
}
