import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// 실제 Claude CLI를 부르지 않도록 백엔드 상태를 고정합니다.
vi.mock("@/lib/ai/selectBackend", () => ({
  backendStatus: async () => ({ live: true, kind: "subscription" }),
}));
// 검증을 통과한 요청이 실제 미션을 돌리지 않게 합니다.
vi.mock("@/lib/ai/orchestrator", () => ({
  runMission: async () => {},
  runRevision: async () => {},
  describeError: (e: unknown) => ({ reason: String(e) }),
}));

const { POST: postMission } = await import("./missions/route");
const { POST: postRevision } = await import("./missions/revise/route");
const { GET: listReports, POST: postReport } = await import("./reports/route");
const { GET: getReport, DELETE: deleteReport } = await import("./reports/[id]/route");
const { POST: postDecision } = await import("./scans/[id]/decision/route");

const json = (body: unknown) =>
  new Request("http://localhost:3000/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-office-api-"));
  process.env.REPORTS_DIR = dir;
});
afterAll(async () => {
  delete process.env.REPORTS_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("POST /api/missions", () => {
  it("빈 지시·너무 긴 지시·잘못된 JSON은 400", async () => {
    expect((await postMission(json({ command: "  " }))).status).toBe(400);
    expect((await postMission(json({ command: "가".repeat(1001) }))).status).toBe(400);
    expect((await postMission(new Request("http://localhost/api", { method: "POST", body: "{" }))).status).toBe(400);
  });

  it("5MB를 넘는 첨부는 413", async () => {
    expect((await postMission(json({ command: "분석해줘", scanXml: "x".repeat(5 * 1024 * 1024 + 1) }))).status).toBe(413);
  });

  it("올바른 지시는 SSE 스트림으로 응답", async () => {
    const res = await postMission(json({ command: "랜섬웨어 동향 정리해줘" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });
});

describe("POST /api/missions/revise", () => {
  const base = { command: "지시", report: "본문", missionId: "abcd1234", round: 2, comment: "출처 보강" };
  it("차수가 2 미만이거나 필수 값이 없으면 400", async () => {
    expect((await postRevision(json({ ...base, round: 1 }))).status).toBe(400);
    expect((await postRevision(json({ ...base, report: "" }))).status).toBe(400);
    expect((await postRevision(json({ ...base, round: 2.5 }))).status).toBe(400);
  });
  it("올바른 요청은 스트림으로 응답", async () => {
    expect((await postRevision(json(base))).status).toBe(200);
  });
});

describe("/api/reports", () => {
  it("제목·본문이 없으면 400", async () => {
    expect((await postReport(json({ title: "", content: "본문" }))).status).toBe(400);
    expect((await postReport(json({ title: "제목" }))).status).toBe(400);
  });

  it("너무 긴 본문은 413", async () => {
    expect((await postReport(json({ title: "제목", content: "가".repeat(500_001) }))).status).toBe(413);
  });

  it("저장 → 목록 → 열람 → 삭제", async () => {
    const res = await postReport(json({ title: "제목", content: "# 본문", round: 0, source: "evil", scan: { decision: "hack" } }));
    expect(res.status).toBe(201);
    const meta = await res.json();
    // 잘못된 값은 안전한 기본값으로 바뀝니다
    expect(meta).toMatchObject({ title: "제목", round: 1, source: "live" });
    expect(meta.scan).toBeUndefined();
    expect(meta.content).toBeUndefined();

    const list = await (await listReports()).json();
    expect(list.map((r: { id: string }) => r.id)).toContain(meta.id);
    expect((await (await getReport(new Request("http://localhost"), ctx(meta.id))).json()).content).toBe("# 본문");

    expect((await deleteReport(new Request("http://localhost"), ctx(meta.id))).status).toBe(204);
    expect((await getReport(new Request("http://localhost"), ctx(meta.id))).status).toBe(404);
  });

  it("경로 조작 id는 404", async () => {
    expect((await getReport(new Request("http://localhost"), ctx("../../etc/passwd"))).status).toBe(404);
    expect((await deleteReport(new Request("http://localhost"), ctx("../x"))).status).toBe(404);
  });
});

describe("POST /api/scans/[id]/decision", () => {
  it("approve가 불리언이 아니면 400, 대기 중인 요청이 없으면 404", async () => {
    expect((await postDecision(json({ approve: "yes" }), ctx("abc"))).status).toBe(400);
    expect((await postDecision(json({ approve: true }), ctx("nope"))).status).toBe(404);
  });
});
