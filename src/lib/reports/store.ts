import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type NewReport, type ReportMeta, type SavedReport, toMeta } from "./types";

/** 보고서는 data/reports/<id>.json 으로 저장합니다 (이 PC 안에만 보관, git 제외). */
export function reportsDir(): string {
  return process.env.REPORTS_DIR || join(process.cwd(), "data", "reports");
}

/** 경로 조작(../ 등)을 막기 위해 id 형식을 엄격하게 제한합니다. */
const ID_PATTERN = /^\d{8}-\d{6}-[a-f0-9]{6}$/;
export const isValidId = (id: string) => ID_PATTERN.test(id);

function newId(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const time = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${date}-${time}-${randomBytes(3).toString("hex")}`;
}

export async function saveReport(input: NewReport, now = new Date()): Promise<SavedReport> {
  const dir = reportsDir();
  await mkdir(dir, { recursive: true });
  const report: SavedReport = { ...input, id: newId(now), approvedAt: now.toISOString() };
  await writeFile(join(dir, `${report.id}.json`), JSON.stringify(report, null, 2), { encoding: "utf8", flag: "wx" });
  return report;
}

export async function getReport(id: string): Promise<SavedReport | null> {
  if (!isValidId(id)) return null;
  try {
    return JSON.parse(await readFile(join(reportsDir(), `${id}.json`), "utf8")) as SavedReport;
  } catch {
    return null;
  }
}

/** 최신순 목록 (본문 제외). 깨진 파일은 건너뜁니다. */
export async function listReports(): Promise<ReportMeta[]> {
  let files: string[];
  try {
    files = await readdir(/*turbopackIgnore: true*/ reportsDir());
  } catch {
    return [];
  }
  const ids = files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter(isValidId);
  const reports = await Promise.all(ids.map(getReport));
  return reports
    .filter((r): r is SavedReport => r !== null)
    .map(toMeta)
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

export async function deleteReport(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  try {
    await rm(join(reportsDir(), `${id}.json`));
    return true;
  } catch {
    return false;
  }
}
