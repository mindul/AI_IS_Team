import { listReports, saveReport } from "@/lib/reports/store";
import { parseScanOutcome } from "@/lib/scan/outcome";
import { type NewReport, toMeta } from "@/lib/reports/types";

/** 저장된 보고서 목록 (최신순, 본문 제외) */
export async function GET() {
  return Response.json(await listReports());
}

const MAX_CONTENT = 500_000;

/** 팀장이 승인한 보고서를 저장합니다. */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string, max: number) => (typeof b?.[k] === "string" ? (b[k] as string).slice(0, max) : "");

  const input: NewReport = {
    title: str("title", 300).trim(),
    summary: str("summary", 1000),
    command: str("command", 2000),
    content: typeof b?.content === "string" ? b.content : "",
    round: typeof b?.round === "number" && Number.isInteger(b.round) && b.round > 0 ? b.round : 1,
    source: b?.source === "sim" ? "sim" : "live",
    ...(parseScanOutcome(b?.scan) ? { scan: parseScanOutcome(b?.scan) } : {}),
  };
  if (!input.title || !input.content) return Response.json({ error: "제목과 본문이 필요합니다" }, { status: 400 });
  if (input.content.length > MAX_CONTENT) return Response.json({ error: "보고서가 너무 깁니다" }, { status: 413 });

  return Response.json(toMeta(await saveReport(input)), { status: 201 });
}
