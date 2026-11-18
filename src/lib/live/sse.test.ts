import { describe, expect, it } from "vitest";
import type { OfficeEvent } from "../office/types";
import { readEventStream } from "./sse";

function responseFrom(chunks: string[]): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        chunks.forEach((s) => c.enqueue(enc.encode(s)));
        c.close();
      },
    }),
  );
}

describe("readEventStream", () => {
  it("청크가 중간에서 잘려 와도 이벤트를 온전히 복원한다", async () => {
    const a: OfficeEvent = { type: "log", from: "chief", text: "안녕하세요 — 한글 테스트" };
    const b: OfficeEvent = { type: "usage", tokens: 10, costKrw: 1.5 };
    const raw = `data: ${JSON.stringify(a)}\n\ndata: ${JSON.stringify(b)}\n\n`;
    const got: OfficeEvent[] = [];
    await readEventStream(responseFrom([raw.slice(0, 17), raw.slice(17, 60), raw.slice(60)]), (e) => got.push(e));
    expect(got).toEqual([a, b]);
  });
});
