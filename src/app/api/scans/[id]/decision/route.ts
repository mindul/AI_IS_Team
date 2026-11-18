import { resolveDecision } from "@/lib/scan/decisions";

type Ctx = { params: Promise<{ id: string }> };

/** 팀장의 점검(스캔) 승인·미승인 결정을 진행 중인 업무에 전달합니다. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as { approve?: unknown } | null;
  if (typeof b?.approve !== "boolean") return Response.json({ error: "approve(true/false)가 필요합니다" }, { status: 400 });
  return resolveDecision(id, b.approve)
    ? new Response(null, { status: 204 })
    : Response.json({ error: "대기 중인 점검 요청이 없습니다 (이미 처리되었거나 업무가 끝났습니다)" }, { status: 404 });
}
