import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteReport, getReport, isValidId, listReports, saveReport } from "./store";

let dir: string;
const base = { title: "보고서", summary: "요약", command: "지시", content: "# 본문", round: 1, source: "live" as const };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-office-reports-"));
  process.env.REPORTS_DIR = dir;
});
afterEach(async () => {
  delete process.env.REPORTS_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("보고서 저장소", () => {
  it("저장 → 조회 → 목록(최신순, 본문 제외) → 삭제", async () => {
    const a = await saveReport({ ...base, title: "첫 보고서" }, new Date("2026-11-18T10:00:00"));
    const b = await saveReport({ ...base, title: "둘째 보고서" }, new Date("2026-11-18T11:00:00"));
    expect(isValidId(a.id)).toBe(true);
    expect(a.id.startsWith("20261118-100000-")).toBe(true);

    expect(await getReport(a.id)).toEqual(a);

    const list = await listReports();
    expect(list.map((r) => r.title)).toEqual(["둘째 보고서", "첫 보고서"]);
    expect(list[0]).not.toHaveProperty("content");

    expect(await deleteReport(b.id)).toBe(true);
    expect((await listReports()).map((r) => r.id)).toEqual([a.id]);
    expect(await deleteReport(b.id)).toBe(false);
  });

  it("잘못된 id(경로 조작 시도 포함)는 거부한다", async () => {
    expect(isValidId("../../etc/passwd")).toBe(false);
    expect(isValidId("20261118-100000-abc12")).toBe(false);
    expect(await getReport("../secret")).toBeNull();
    expect(await deleteReport("../secret")).toBe(false);
  });

  it("폴더가 없으면 빈 목록, 깨진 파일은 건너뛴다", async () => {
    await rm(dir, { recursive: true, force: true });
    expect(await listReports()).toEqual([]);
    const ok = await saveReport(base);
    await writeFile(join(dir, "20261118-000000-ffffff.json"), "{깨진 JSON");
    expect((await readdir(dir)).length).toBe(2);
    expect((await listReports()).map((r) => r.id)).toEqual([ok.id]);
  });
});
