import { describe, expect, it } from "vitest";
import { summaryOf } from "./report";
import { costOf } from "./usage";

describe("costOf", () => {
  it("모델 단가·캐시·웹 검색을 반영해 원화로 계산한다", () => {
    // Sonnet 5.5: 입력 $2, 출력 $10 / 1M. 검색 $10 / 1,000회. 환율 1,400원
    const c = costOf("claude-sonnet-5-5", {
      input_tokens: 1_000_000,
      output_tokens: 100_000,
      cache_read_input_tokens: 1_000_000,
      server_tool_use: { web_search_requests: 2 },
    });
    // 2 + 1 + 0.2 + 0.02 = 3.22 USD
    expect(c.costKrw).toBeCloseTo(3.22 * 1400, 5);
    expect(c.tokens).toBe(2_100_000);
  });

  it("모르는 모델은 Opus 5.5 단가로 계산한다", () => {
    expect(costOf("unknown", { input_tokens: 1_000_000, output_tokens: 0 }).costKrw).toBeCloseTo(4 * 1400);
  });
});

describe("summaryOf", () => {
  it("## 요약 섹션만 한 줄로 뽑는다", () => {
    const r = "# 제목\n\n## 요약\n- 첫째 줄\n- 둘째 줄\n\n## 팀장 결정 필요 사항\n- 예산";
    expect(summaryOf(r)).toBe("첫째 줄 둘째 줄");
  });

  it("요약 섹션이 없으면 앞부분을 120자로 자른다", () => {
    expect(summaryOf("가".repeat(200))).toBe(`${"가".repeat(120)}…`);
  });
});
