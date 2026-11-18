"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { INITIAL_STATE, officeReducer } from "../office/reducer";
import type { OfficeEvent } from "../office/types";
import { readEventStream } from "./sse";

/**
 * 3단계: 서버(/api/missions)가 실제 Claude로 일하면서 보내는 이벤트를 받아 화면에 반영합니다.
 * 인터페이스는 시뮬레이션 훅과 같습니다 (state, start, approve, reject, stop).
 */
export function useLiveOffice() {
  const [state, dispatch] = useReducer(officeReducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const scanIdRef = useRef<string | null>(null);

  const emit = useCallback((event: OfficeEvent) => dispatch({ event, at: Date.now() }), []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (url: string, body: unknown) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      let sawEnd = false;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          const msg = (await res.json().catch(() => null))?.error ?? `서버 오류 (${res.status})`;
          emit({ type: "mission_failed", reason: msg });
          return;
        }
        await readEventStream(res, (e) => {
          if (e.type === "approval_requested" || e.type === "mission_failed") sawEnd = true;
          if (e.type === "scan_approval_requested") scanIdRef.current = e.scan.id;
          emit(e);
        });
        if (!sawEnd) emit({ type: "mission_failed", reason: "서버 연결이 예기치 않게 끊겼습니다" });
      } catch (err) {
        if (controller.signal.aborted) emit({ type: "mission_failed", reason: "팀장이 업무를 중지했습니다" });
        else emit({ type: "mission_failed", reason: err instanceof Error ? err.message : "알 수 없는 오류" });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [emit],
  );

  const start = useCallback(
    (command: string, extra?: { scanXml?: string }) => {
      if (state.phase !== "idle") return;
      void run("/api/missions", { command, scanXml: extra?.scanXml });
    },
    [state.phase, run],
  );

  /** 팀장의 점검(스캔) 승인·미승인 결정을 서버에 전달합니다. 결과는 진행 중인 스트림으로 돌아옵니다. 전달했으면 true */
  const decideScan = useCallback(
    async (approve: boolean): Promise<boolean> => {
      const id = state.scanRequest?.id ?? scanIdRef.current;
      if (!id) return false;
      const res = await fetch(`/api/scans/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      }).catch(() => null);
      if (res?.ok) return true;
      emit({ type: "log", from: "chief", text: "점검 결정을 전달하지 못했습니다. 다시 눌러 보고, 계속 안 되면 업무를 중지해 주세요." });
      return false;
    },
    [state.scanRequest, emit],
  );

  const approve = useCallback(() => {
    if (state.phase !== "awaiting_approval") return;
    emit({ type: "approval_resolved", decision: "approved" });
  }, [state.phase, emit]);

  const reject = useCallback(
    (comment: string) => {
      const { approval, command, missionId } = state;
      if (state.phase !== "awaiting_approval" || !approval || !command || !missionId) return;
      emit({ type: "approval_resolved", decision: "rejected", comment });
      void run("/api/missions/revise", {
        command,
        missionId,
        comment,
        title: approval.title,
        report: approval.content,
        round: approval.round + 1,
        contributors: approval.contributors,
        appendix: approval.appendix,
        scan: approval.scan,
      });
    },
    [state, emit, run],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const clearLogs = useCallback(() => emit({ type: "logs_cleared" }), [emit]);
  /** 화면 쪽 작업(보고서 저장 등)의 결과를 업무 로그에 남깁니다. */
  const log = useCallback((text: string) => emit({ type: "log", from: "chief", text }), [emit]);

  return { state, start, approve, reject, stop, clearLogs, log, decideScan };
}
