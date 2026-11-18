import { describe, expect, it } from "vitest";
import { buildMission, buildRework, pickWriters, topicOf } from "../sim/scenario";
import { INITIAL_STATE, officeReducer } from "./reducer";
import type { OfficeEvent, OfficeState } from "./types";

const play = (state: OfficeState, events: OfficeEvent[], at = 1_700_000_000_000) =>
  events.reduce((s, event, i) => officeReducer(s, { event, at: at + i * 1000 }), state);

describe("topicOf / pickWriters", () => {
  it("요청 어미를 떼고 주제만 남긴다", () => {
    expect(topicOf("최근 랜섬웨어 동향 보고서 만들어줘")).toBe("최근 랜섬웨어 동향 보고서");
    expect(topicOf("피싱 메일 대응 교육자료를 작성해 주세요.")).toBe("피싱 메일 대응 교육자료");
    expect(topicOf("해줘")).toBe("해줘");
  });

  it("키워드로 담당자를 고르고, 없으면 기본 담당자", () => {
    expect(pickWriters("보안 점검 체크리스트 만들어줘")).toEqual(["vuln"]);
    expect(pickWriters("고객 신용정보 유출 사고 경위서")).toEqual(["incident", "compliance"]);
    expect(pickWriters("전자금융감독규정 개정 내용과 임직원 공지")).toEqual(["compliance", "awareness"]);
    expect(pickWriters("제로트러스트 알아봐")).toEqual(["vuln", "incident"]);
  });
});

describe("officeReducer + 시뮬레이션 시나리오", () => {
  const mission = buildMission("m1", "보안 점검 체크리스트 만들어줘").map((t) => t.event);

  it("지시 → 결재 요청까지 진행된다", () => {
    const s = play(INITIAL_STATE, mission);
    expect(s.phase).toBe("awaiting_approval");
    expect(s.approval?.title).toBe("보안 점검 체크리스트 — 최종 보고서");
    expect(s.statuses).toMatchObject({ chief: "review", threat: "done", vuln: "done", incident: "idle" });
    expect(s.usage.searches).toBe(2);
    expect(s.usage.tokens).toBeGreaterThan(0);
    expect(s.logs[0]).toMatchObject({ from: "lead", to: "chief", text: "보안 점검 체크리스트 만들어줘" });
    expect(s.handoffs.length).toBeGreaterThan(0);
  });

  it("컴플라이언스 담당이 참여하면 법령 개정 검색을 추가로 한다", () => {
    const s = play(INITIAL_STATE, buildMission("m3", "개인정보 처리방침 규정 검토해줘").map((t) => t.event));
    expect(s.usage.searches).toBe(3);
    expect(s.logs.some((l) => l.from === "compliance" && l.text.includes("신용정보법"))).toBe(true);
  });

  it("승인하면 대기 상태로 돌아가고 참여 직원은 완료", () => {
    const s = play(play(INITIAL_STATE, mission), [{ type: "approval_resolved", decision: "approved" }]);
    expect(s.phase).toBe("idle");
    expect(s.approval).toBeNull();
    expect(s.statuses).toMatchObject({ chief: "done", vuln: "done", incident: "idle" });
    expect(s.logs.at(-1)).toMatchObject({ kind: "report", text: "보고서 승인 — 보안 점검 체크리스트 — 최종 보고서" });
  });

  it("반려하면 의견이 기록되고, 수정본이 다시 결재로 올라온다", () => {
    const waiting = play(INITIAL_STATE, mission);
    const rejected = play(waiting, [{ type: "approval_resolved", decision: "rejected", comment: "출처 보강" }]);
    expect(rejected.phase).toBe("running");
    expect(rejected.logs.at(-1)).toMatchObject({ from: "lead", kind: "report", text: "보고서 반려 — 출처 보강" });

    const rework = buildRework("m1", 2, "출처 보강", waiting.approval!.title).map((t) => t.event);
    const again = play(rejected, rework);
    expect(again.phase).toBe("awaiting_approval");
    expect(again.approval?.title).toBe("보안 점검 체크리스트 — 최종 보고서 (수정 1차)");
  });

  it("결재가 없을 때 승인 이벤트는 무시된다", () => {
    expect(play(INITIAL_STATE, [{ type: "approval_resolved", decision: "approved" }])).toBe(INITIAL_STATE);
  });

  it("새 지시가 들어오면 직원 상태가 초기화되고 로그·사용량은 누적된다", () => {
    const done = play(play(INITIAL_STATE, mission), [{ type: "approval_resolved", decision: "approved" }]);
    const next = play(done, [{ type: "mission_started", missionId: "m2", command: "두 번째 지시" }]);
    expect(Object.values(next.statuses).every((st) => st === "idle")).toBe(true);
    expect(next.logs.length).toBe(done.logs.length + 1);
    expect(next.usage).toEqual(done.usage);
  });

  it("업무가 중단되면 작업 중이던 직원은 오류, 사무실은 대기 상태가 된다", () => {
    const started = play(INITIAL_STATE, mission.slice(0, 8)); // 위협정보 분석가 작업 중
    expect(started.statuses.threat).toBe("working");
    const failed = play(started, [{ type: "mission_failed", reason: "팀장이 업무를 중지했습니다" }]);
    expect(failed.phase).toBe("idle");
    expect(failed.statuses).toMatchObject({ chief: "error", threat: "error", vuln: "idle" });
    expect(failed.logs.at(-1)?.text).toBe("업무 중단 — 팀장이 업무를 중지했습니다");
  });

  it("로그 초기화는 로그만 비우고 진행 상태·결재·사용량은 그대로 둔다", () => {
    const waiting = play(INITIAL_STATE, mission);
    const cleared = play(waiting, [{ type: "logs_cleared" }]);
    expect(cleared.logs).toEqual([]);
    expect(cleared.phase).toBe("awaiting_approval");
    expect(cleared.approval).toEqual(waiting.approval);
    expect(cleared.usage).toEqual(waiting.usage);
    // 초기화 후 새 로그도 정상적으로 쌓인다
    const next = play(cleared, [{ type: "approval_resolved", decision: "approved" }]);
    expect(next.logs).toHaveLength(1);
  });

  it("직원별 최근 업무를 기억하고, 새 지시가 오면 초기화한다", () => {
    const s = play(INITIAL_STATE, mission);
    expect(s.tasks.chief).toBe("보안 점검 체크리스트 만들어줘");
    expect(s.tasks.threat).toContain("위협 동향 조사 요청");
    expect(s.tasks.vuln).toBe("점검 체크리스트·조치 계획 작성 요청");
    const next = play(s, [{ type: "mission_started", missionId: "m2", command: "새 지시" }]);
    expect(next.tasks).toEqual({ chief: "새 지시" });
  });

  it("점검 승인 요청 → 승인/미승인 처리", () => {
    const scan = {
      id: "s1",
      targets: [{ name: "내 PC", target: "127.0.0.1" }],
      profile: "quick" as const,
      profileLabel: "주요 포트 확인",
      profileDesc: "",
      reason: "열린 포트 확인",
    };
    const started = play(INITIAL_STATE, [{ type: "mission_started", missionId: "m", command: "내 PC 포트 점검" }]);
    const asked = play(started, [{ type: "scan_approval_requested", scan }]);
    expect(asked.phase).toBe("awaiting_scan");
    expect(asked.scanRequest?.id).toBe("s1");
    expect(asked.logs.at(-1)).toMatchObject({ kind: "scan", text: "스캔 실행 승인 요청: 내 PC — 주요 포트 확인" });

    const ok = play(asked, [{ type: "scan_resolved", decision: "approved" }]);
    expect(ok).toMatchObject({ phase: "running", scanRequest: null });
    expect(ok.logs.at(-1)).toMatchObject({ kind: "scan", text: "스캔 실행 승인" });

    const no = play(asked, [{ type: "scan_resolved", decision: "rejected" }]);
    expect(no.logs.at(-1)).toMatchObject({ kind: "scan", text: "스캔 실행 거절 — 스캔 없이 진행" });

    const stopped = play(asked, [{ type: "mission_failed", reason: "중지" }]);
    expect(stopped).toMatchObject({ phase: "idle", scanRequest: null });
  });
});
