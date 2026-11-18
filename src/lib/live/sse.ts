import type { OfficeEvent } from "../office/types";

/** fetch 응답 본문(SSE)을 읽어 OfficeEvent를 하나씩 넘겨줍니다. */
export async function readEventStream(res: Response, onEvent: (e: OfficeEvent) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as OfficeEvent);
    }
  }
}
