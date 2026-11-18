"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { INITIAL_STATE, officeReducer } from "../office/reducer";
import type { OfficeEvent } from "../office/types";
import { buildMission, buildRework, type TimedEvent } from "./scenario";

/**
 * 2단계: 미리 짜둔 시나리오를 실제 시간 흐름에 맞춰 재생합니다 (API 비용 없음).
 * 실제 AI 버전(useLiveOffice)과 같은 인터페이스를 가집니다.
 */
export function useSimulatedOffice() {
  const [state, dispatch] = useReducer(officeReducer, INITIAL_STATE);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const emit = useCallback((event: OfficeEvent) => dispatch({ event, at: Date.now() }), []);

  const playSequence = useCallback(
    (events: TimedEvent[]) => {
      let elapsed = 0;
      for (const { delay, event } of events) {
        elapsed += delay;
        timers.current.push(setTimeout(() => emit(event), elapsed));
      }
    },
    [emit],
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = useCallback(
    // 시뮬레이션은 첨부 파일을 쓰지 않으므로 두 번째 인자(첨부)는 받지 않습니다.
    (command: string) => {
      if (state.phase !== "idle") return;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      playSequence(buildMission(crypto.randomUUID().slice(0, 8), command));
    },
    [state.phase, playSequence],
  );

  const approve = useCallback(() => {
    if (state.phase !== "awaiting_approval") return;
    emit({ type: "approval_resolved", decision: "approved" });
  }, [state.phase, emit]);

  const reject = useCallback(
    (comment: string) => {
      if (state.phase !== "awaiting_approval" || !state.approval || !state.missionId) return;
      const { title, round, contributors } = state.approval;
      emit({ type: "approval_resolved", decision: "rejected", comment });
      playSequence(buildRework(state.missionId, round + 1, comment, title, contributors));
    },
    [state.phase, state.approval, state.missionId, emit, playSequence],
  );

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    emit({ type: "mission_failed", reason: "팀장이 업무를 중지했습니다" });
  }, [emit]);

  const clearLogs = useCallback(() => emit({ type: "logs_cleared" }), [emit]);
  /** 화면 쪽 작업(보고서 저장 등)의 결과를 업무 로그에 남깁니다. */
  const log = useCallback((text: string) => emit({ type: "log", from: "chief", text }), [emit]);

  /** 시뮬레이션에는 실제 점검이 없습니다 (화면 인터페이스만 맞춤) */
  const decideScan = useCallback(async (): Promise<boolean> => true, []);

  return { state, start, approve, reject, stop, clearLogs, log, decideScan };
}
