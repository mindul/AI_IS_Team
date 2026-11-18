import { describe, expect, it } from "vitest";
import { parseStreamLine } from "./claudeCodeStream";

// 실제 `claude -p --output-format stream-json` 출력에서 필요한 필드만 남긴 예시
describe("parseStreamLine", () => {
  it("WebSearch 도구 호출을 검색 이벤트로 읽는다", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "WebSearch", input: { query: "금융보안원 보안 권고", mode: "standard" } }] },
    });
    expect(parseStreamLine(line)).toEqual({ kind: "search", query: "금융보안원 보안 권고" });
  });

  it("구독 사용률을 읽는다 (초 단위 시각 → ms)", () => {
    const line = JSON.stringify({
      type: "rate_limit_event",
      rate_limit_info: {
        status: "allowed",
        resetsAt: 1795011000,
        unifiedWindows: {
          five_hour: { utilization: 0.21, resetsAt: 1795011000, status: "allowed" },
          seven_day: { utilization: 0.17, resetsAt: 1795060800, status: "allowed" },
        },
      },
    });
    expect(parseStreamLine(line)).toEqual({
      kind: "quota",
      quota: { status: "allowed", fiveHour: 0.21, sevenDay: 0.17, resetsAt: 1795011000_000 },
    });
  });

  it("최종 결과에서 본문·구조화 출력·토큰 합계를 읽는다", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: '{"title":"x"}',
      structured_output: { title: "x" },
      stop_reason: "end_turn",
      api_error_status: null,
      modelUsage: {
        "claude-opus-5-5": { inputTokens: 2, outputTokens: 91, cacheReadInputTokens: 10, cacheCreationInputTokens: 1187 },
      },
    });
    expect(parseStreamLine(line)).toMatchObject({
      kind: "result",
      ok: true,
      text: '{"title":"x"}',
      structured: { title: "x" },
      tokens: 1290,
      refused: false,
    });
  });

  it("오류 결과와 거절을 구분한다", () => {
    expect(parseStreamLine(JSON.stringify({ type: "result", subtype: "error_max_turns", is_error: true }))).toMatchObject({
      ok: false,
      subtype: "error_max_turns",
    });
    expect(parseStreamLine(JSON.stringify({ type: "result", subtype: "success", stop_reason: "refusal" }))).toMatchObject({
      refused: true,
    });
  });

  it("JSON이 아닌 줄이나 관심 없는 이벤트는 무시한다", () => {
    expect(parseStreamLine("not json")).toEqual({ kind: "other" });
    expect(parseStreamLine(JSON.stringify({ type: "system", subtype: "init" }))).toEqual({ kind: "other" });
  });
});
