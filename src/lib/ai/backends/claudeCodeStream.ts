import type { Quota } from "../../office/types";

/** Claude Code `--output-format stream-json` 한 줄을 해석한 결과 */
export type StreamItem =
  | { kind: "search"; query: string }
  | { kind: "quota"; quota: Quota }
  | {
      kind: "result";
      ok: boolean;
      text: string;
      structured?: unknown;
      tokens: number;
      refused: boolean;
      errorStatus?: number | null;
      subtype?: string;
    }
  | { kind: "other" };

interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export function parseStreamLine(line: string): StreamItem {
  let e: Record<string, unknown>;
  try {
    e = JSON.parse(line);
  } catch {
    return { kind: "other" };
  }

  if (e.type === "assistant") {
    const content = (e.message as { content?: unknown[] } | undefined)?.content ?? [];
    for (const b of content as { type?: string; name?: string; input?: { query?: unknown } }[]) {
      if (b.type === "tool_use" && b.name === "WebSearch") return { kind: "search", query: String(b.input?.query ?? "") };
    }
    return { kind: "other" };
  }

  if (e.type === "rate_limit_event") {
    const info = (e.rate_limit_info ?? {}) as {
      status?: string;
      resetsAt?: number;
      unifiedWindows?: Record<string, { utilization?: number; resetsAt?: number }>;
    };
    const w = info.unifiedWindows ?? {};
    const reset = w.five_hour?.resetsAt ?? info.resetsAt;
    return {
      kind: "quota",
      quota: {
        status: info.status ?? "unknown",
        fiveHour: w.five_hour?.utilization,
        sevenDay: w.seven_day?.utilization,
        resetsAt: typeof reset === "number" ? reset * 1000 : undefined,
      },
    };
  }

  if (e.type === "result") {
    const usage = Object.values((e.modelUsage ?? {}) as Record<string, ModelUsage>);
    const tokens = usage.reduce(
      (n, u) =>
        n + (u.inputTokens ?? 0) + (u.outputTokens ?? 0) + (u.cacheReadInputTokens ?? 0) + (u.cacheCreationInputTokens ?? 0),
      0,
    );
    return {
      kind: "result",
      ok: e.is_error !== true && e.subtype === "success",
      text: typeof e.result === "string" ? e.result : "",
      structured: e.structured_output ?? undefined,
      tokens,
      refused: e.stop_reason === "refusal",
      errorStatus: (e.api_error_status as number | null | undefined) ?? null,
      subtype: typeof e.subtype === "string" ? e.subtype : undefined,
    };
  }

  return { kind: "other" };
}
