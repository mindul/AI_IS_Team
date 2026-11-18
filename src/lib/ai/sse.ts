import "server-only";

import type { OfficeEvent } from "../office/types";
import { describeError } from "./orchestrator";

type Job = (emit: (e: OfficeEvent) => void, signal: AbortSignal) => Promise<void>;

/**
 * 작업을 실행하면서 발생하는 OfficeEvent를 Server-Sent Events로 흘려보냅니다.
 * 브라우저가 연결을 끊으면(중지 버튼, 새로고침) request.signal로 Claude 호출도 함께 취소됩니다.
 */
export function eventStream(job: Job, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit = (event: OfficeEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };
      try {
        await job(emit, signal);
      } catch (err) {
        if (!signal.aborted) {
          console.error("[mission]", err);
          emit({ type: "mission_failed", ...describeError(err) });
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
