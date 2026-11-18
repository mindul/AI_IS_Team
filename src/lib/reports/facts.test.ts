import { describe, expect, it } from "vitest";
import { reportFacts } from "./facts";

describe("reportFacts", () => {
  it("서로 다른 출처 URL과 확인 필요 표시를 센다", () => {
    const md = [
      "- 금융보안원 권고 (https://www.fsec.or.kr/notice/1).",
      "- 같은 출처 다시 [링크](https://www.fsec.or.kr/notice/1/)",
      "- KISA <https://www.krcert.or.kr/a?b=1>",
      "- 피해 규모 약 30% (확인 필요)",
      "- 조항 번호 (검토 필요), 날짜 (확인 필요)",
    ].join("\n");
    expect(reportFacts(md)).toEqual({ sources: 2, checks: 3 });
  });

  it("근거가 없으면 0", () => {
    expect(reportFacts("# 제목\n본문")).toEqual({ sources: 0, checks: 0 });
  });
});
