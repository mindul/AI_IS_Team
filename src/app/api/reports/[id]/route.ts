import { deleteReport, getReport } from "@/lib/reports/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const report = await getReport((await params).id);
  return report ? Response.json(report) : Response.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return (await deleteReport((await params).id))
    ? new Response(null, { status: 204 })
    : Response.json({ error: "보고서를 찾을 수 없습니다" }, { status: 404 });
}
