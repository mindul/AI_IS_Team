import "server-only";

import type { Backend } from "./backend";
import { apiBackend } from "./backends/api";
import { claudeCodeBackend, subscriptionStatus } from "./backends/claudeCode";

export type BackendKind = Backend["kind"];

/** 기본은 구독(Claude Code CLI). AI_BACKEND=api 로 설정했을 때만 API 키 방식을 씁니다. */
export function backendKind(): BackendKind {
  return process.env.AI_BACKEND === "api" ? "api" : "subscription";
}

export function getBackend(): Backend {
  return backendKind() === "api" ? apiBackend : claudeCodeBackend;
}

export interface BackendStatus {
  live: boolean;
  kind: BackendKind;
  /** 구독 요금제 이름 (pro, max …) */
  plan?: string;
  /** 사용할 수 없을 때 안내 문구 */
  hint?: string;
}

export async function backendStatus(): Promise<BackendStatus> {
  if (backendKind() === "api") {
    const live = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    return { live, kind: "api", hint: live ? undefined : ".env.local에 ANTHROPIC_API_KEY를 넣고 서버를 다시 시작하세요" };
  }
  const s = await subscriptionStatus();
  return {
    live: s.ok,
    kind: "subscription",
    plan: s.plan,
    hint: s.ok ? undefined : "터미널에서 `claude` 를 실행해 Claude Pro 계정으로 로그인하세요",
  };
}
