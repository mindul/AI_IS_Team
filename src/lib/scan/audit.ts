import "server-only";

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/** 점검 감사 기록: data/audit/scan-log.jsonl (한 줄에 한 건, 이 PC에만 보관) */
export function auditFile(): string {
  return process.env.SCAN_AUDIT_FILE || join(/*turbopackIgnore: true*/ process.cwd(), "data", "audit", "scan-log.jsonl");
}

export async function audit(entry: Record<string, unknown>): Promise<void> {
  const file = auditFile();
  await mkdir(join(file, ".."), { recursive: true });
  await appendFile(file, `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`, "utf8");
}
