import "server-only";

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildNmapArgs } from "./profiles";
import { parseTargets } from "./targets";
import type { ScanProfileId, ScanTarget } from "./types";

const NMAP = process.env.NMAP_PATH || "nmap";
const SCAN_TIMEOUT_MS = 20 * 60_000;

export function targetsFile(): string {
  return process.env.SCAN_TARGETS_FILE || join(/*turbopackIgnore: true*/ process.cwd(), "config", "scan-targets.json");
}

/** 허용 목록 읽기. 파일이 없으면 빈 목록(스캔 불가)입니다. */
export async function loadTargets(): Promise<{ targets: ScanTarget[]; errors: string[] }> {
  try {
    return parseTargets(JSON.parse(await readFile(targetsFile(), "utf8")));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { targets: [], errors: [] };
    return { targets: [], errors: ["config/scan-targets.json을 읽을 수 없습니다 (JSON 형식 확인)"] };
  }
}

/** 한 번에 하나의 스캔만 실행합니다. */
let running = false;

/** 셸을 거치지 않고(execFile) nmap을 실행해 XML을 돌려줍니다. */
export function runNmap(profile: ScanProfileId, targets: ScanTarget[], signal: AbortSignal): Promise<string> {
  if (running) return Promise.reject(new Error("다른 스캔이 진행 중입니다. 끝난 뒤 다시 시도해 주세요"));
  running = true;
  return new Promise<string>((resolve, reject) => {
    execFile(
      /*turbopackIgnore: true*/ NMAP,
      buildNmapArgs(
        profile,
        targets.map((t) => t.target),
      ),
      { timeout: SCAN_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024, signal },
      (err, stdout, stderr) => {
        running = false;
        if (err) {
          const e = err as NodeJS.ErrnoException;
          if (e.code === "ENOENT") return reject(new Error("nmap을 찾을 수 없습니다 (brew install nmap)"));
          if (e.name === "AbortError") return reject(err);
          return reject(new Error(`nmap 실행 실패: ${(stderr || e.message).trim().slice(-200)}`));
        }
        resolve(stdout);
      },
    );
  });
}
