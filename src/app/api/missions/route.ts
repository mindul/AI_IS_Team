import { runMission } from "@/lib/ai/orchestrator";
import { backendStatus } from "@/lib/ai/selectBackend";
import { eventStream } from "@/lib/ai/sse";

const MAX_COMMAND_LENGTH = 1000;
/** 첨부할 수 있는 nmap XML 최대 크기 */
const MAX_SCAN_XML = 5 * 1024 * 1024;

/** 팀장 지시 1건을 실행하고 진행 상황을 SSE로 돌려줍니다. */
export async function POST(request: Request) {
  const status = await backendStatus();
  if (!status.live) return Response.json({ error: status.hint ?? "실제 AI를 사용할 수 없습니다" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { command?: unknown; scanXml?: unknown } | null;
  const command = typeof body?.command === "string" ? body.command.trim() : "";
  if (!command) return Response.json({ error: "지시 내용이 비어 있습니다" }, { status: 400 });
  if (command.length > MAX_COMMAND_LENGTH)
    return Response.json({ error: `지시는 ${MAX_COMMAND_LENGTH}자 이내로 입력해 주세요` }, { status: 400 });

  const scanXml = typeof body?.scanXml === "string" && body.scanXml.trim() ? body.scanXml : undefined;
  if (scanXml && scanXml.length > MAX_SCAN_XML)
    return Response.json({ error: "첨부 파일은 5MB 이하만 분석할 수 있습니다" }, { status: 413 });

  return eventStream(
    (emit, signal) => runMission(command, emit, signal, undefined, { scanXml }),
    request.signal,
  );
}
