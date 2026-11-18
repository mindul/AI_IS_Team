import "server-only";

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Backend, RunHooks, RunRequest, RunResult } from "../backend";
import { AgentRefusalError, UserFacingError } from "../errors";
import { parseStreamLine } from "./claudeCodeStream";

const CLI = process.env.CLAUDE_CLI_PATH || "claude";
const CALL_TIMEOUT_MS = 10 * 60 * 1000;

/** 프로젝트 파일(CLAUDE.md 등)과 섞이지 않도록 빈 작업 폴더에서 실행합니다. */
function workDir(): string {
  const dir = join(tmpdir(), "ai-office-claude-work");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** API 키가 환경에 있으면 Claude Code가 API 요금으로 동작하므로, 반드시 빼고 구독 로그인만 쓰게 합니다. */
function subscriptionEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function buildArgs(req: RunRequest): string[] {
  const args = [
    "-p",
    "--model", req.model,
    "--effort", req.effort,
    "--output-format", "stream-json",
    "--verbose",
    "--system-prompt", req.system,
    // 이 PC의 사용자 설정·플러그인·MCP·슬래시 명령을 섞지 않음
    "--setting-sources", "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    // 문서 작성만: 파일·명령 도구 없음, 필요할 때 웹 검색만 허용
    "--tools", req.searchLimit ? "WebSearch" : "",
    "--max-turns", String(req.searchLimit ? req.searchLimit + 4 : 3),
  ];
  if (req.searchLimit) args.push("--allowedTools", "WebSearch");
  if (req.jsonSchema) args.push("--json-schema", JSON.stringify(req.jsonSchema));
  return args;
}

function userPrompt(req: RunRequest): string {
  return req.searchLimit ? `${req.user}\n\n(웹 검색은 최대 ${req.searchLimit}회까지만 사용하세요.)` : req.user;
}

/** Claude Pro/Max 구독으로 로그인된 Claude Code CLI를 호출합니다. API 요금이 발생하지 않습니다. */
export const claudeCodeBackend: Backend = {
  kind: "subscription",

  run(req: RunRequest, hooks: RunHooks, signal: AbortSignal): Promise<RunResult> {
    return new Promise<RunResult>((resolve, reject) => {
      signal.throwIfAborted();
      const child = spawn(/*turbopackIgnore: true*/ CLI, buildArgs(req), { cwd: workDir(), env: subscriptionEnv(), stdio: ["pipe", "pipe", "pipe"] });
      let stderr = "";
      let settled = false;
      let result: RunResult | null = null;
      let failure: Error | null = null;

      const finish = (err: Error | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        if (err) reject(err);
        else if (result) resolve(result);
        else reject(new UserFacingError(`Claude Code가 결과 없이 종료되었습니다${stderr ? `: ${stderr.trim().slice(-200)}` : ""}`));
      };
      const onAbort = () => {
        child.kill("SIGTERM");
        finish(signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        finish(new UserFacingError("Claude Code 응답이 10분 넘게 없어 중단했습니다"));
      }, CALL_TIMEOUT_MS);

      child.on("error", (err: NodeJS.ErrnoException) =>
        finish(
          err.code === "ENOENT"
            ? new UserFacingError("Claude Code CLI(claude)를 찾을 수 없습니다. 설치 후 `claude` 로 로그인해 주세요")
            : err,
        ),
      );
      child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));

      createInterface({ input: child.stdout }).on("line", (line) => {
        const item = parseStreamLine(line);
        if (item.kind === "search") hooks.onSearch(item.query);
        else if (item.kind === "quota") hooks.onQuota(item.quota);
        else if (item.kind === "result") {
          hooks.onUsage({ tokens: item.tokens, costKrw: 0 });
          if (item.refused) failure = new AgentRefusalError(req.agentId, "안전 정책");
          else if (item.ok) result = { text: item.text.trim(), structured: item.structured };
          else if (item.errorStatus === 429 || /limit/i.test(item.text))
            failure = new UserFacingError("Claude 구독 사용 한도에 도달했습니다. 한도가 초기화된 뒤 다시 시도해 주세요");
          else if (item.subtype === "error_max_turns")
            failure = new UserFacingError(`${req.agentId} 작업이 허용된 단계 수를 넘겨 중단되었습니다`);
          else failure = new UserFacingError(`Claude Code 오류: ${item.text || item.subtype || "알 수 없음"}`);
        }
      });

      child.on("close", (code) => {
        if (failure) return finish(failure);
        if (!result && code !== 0) {
          const hint = /not logged in|login|auth/i.test(stderr) ? " (터미널에서 `claude` 를 실행해 로그인해 주세요)" : "";
          return finish(new UserFacingError(`Claude Code 실행 실패 (종료 코드 ${code})${hint}`));
        }
        finish(null);
      });

      child.stdin.end(userPrompt(req));
    });
  },
};

/** 구독 로그인 상태 확인 (화면의 "실제 AI" 사용 가능 여부). 60초 캐시. */
let authCache: { at: number; value: { ok: boolean; plan?: string } } | null = null;

export function subscriptionStatus(): Promise<{ ok: boolean; plan?: string }> {
  if (authCache && Date.now() - authCache.at < 60_000) return Promise.resolve(authCache.value);
  return new Promise((resolve) => {
    const child = spawn(/*turbopackIgnore: true*/ CLI, ["auth", "status"], { env: subscriptionEnv(), stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    const done = (value: { ok: boolean; plan?: string }) => {
      authCache = { at: Date.now(), value };
      resolve(value);
    };
    child.stdout.on("data", (d) => (out += d));
    child.on("error", () => done({ ok: false }));
    child.on("close", () => {
      try {
        const s = JSON.parse(out) as { loggedIn?: boolean; authMethod?: string; subscriptionType?: string };
        // 이메일 등 개인정보는 꺼내지 않습니다
        done({ ok: Boolean(s.loggedIn && s.authMethod === "claude.ai"), plan: s.subscriptionType });
      } catch {
        done({ ok: false });
      }
    });
  });
}
