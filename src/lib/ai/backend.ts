import type { AgentId, Quota } from "../office/types";

export type Effort = "low" | "medium" | "high";

export interface RunRequest {
  agentId: AgentId;
  model: string;
  system: string;
  user: string;
  effort: Effort;
  maxTokens: number;
  /** 웹 검색 허용 횟수 (없으면 검색 도구 없음) */
  searchLimit?: number;
  /** 구조화 출력(JSON)이 필요할 때의 JSON Schema */
  jsonSchema?: Record<string, unknown>;
}

export interface RunHooks {
  onSearch: (query: string) => void;
  onUsage: (u: { tokens: number; costKrw: number }) => void;
  onQuota: (q: Quota) => void;
}

export interface RunResult {
  text: string;
  /** jsonSchema를 준 경우 파싱된 결과 */
  structured?: unknown;
}

/** Claude를 부르는 방식. 구독(Claude Code CLI) 또는 API 키. */
export interface Backend {
  kind: "subscription" | "api";
  run(req: RunRequest, hooks: RunHooks, signal: AbortSignal): Promise<RunResult>;
}
