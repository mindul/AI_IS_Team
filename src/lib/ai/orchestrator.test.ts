import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { INITIAL_STATE, officeReducer } from "../office/reducer";
import type { OfficeEvent } from "../office/types";
import type { Backend, RunRequest } from "./backend";
import { AgentRefusalError } from "./errors";
import { type ScanDeps, runMission, runRevision } from "./orchestrator";

const SAMPLE_XML = readFileSync(join(__dirname, "../scan/__fixtures__/sample.xml"), "utf8");

/** 가짜 백엔드. 실제 Claude를 부르지 않고 오케스트레이션 흐름만 검증합니다. */
const PLAN = {
  understanding: "랜섬웨어 대응 준비 상태 점검으로 이해했습니다",
  report_title: "랜섬웨어 대응 준비 점검 보고서",
  research_focus: ["최근 금융권 랜섬웨어 동향"],
  assignments: [
    { agent: "vuln", task: "점검 체크리스트" },
    { agent: "compliance", task: "법규 검토" },
  ],
  scan_targets: [] as string[],
  scan_profile: "quick",
  scan_reason: "",
};

let calls: RunRequest[] = [];
let plan = PLAN;
let failAgent: string | null = null;
let refuseAgent: string | null = null;

function fakeBackend(kind: Backend["kind"] = "subscription", costKrw = 0): Backend {
  return {
    kind,
    async run(req, hooks) {
      calls.push(req);
      if (req.agentId === failAgent) throw new Error("네트워크 오류");
      if (req.agentId === refuseAgent) throw new AgentRefusalError(req.agentId, "cyber");
      if (req.searchLimit) hooks.onSearch(`${req.agentId} 검색`);
      hooks.onUsage({ tokens: 1500, costKrw });
      hooks.onQuota({ status: "allowed", fiveHour: 0.2, sevenDay: 0.1 });
      if (req.jsonSchema) return { text: "", structured: plan };
      const text = req.agentId === "chief" ? "# 보고서\n\n## 요약\n- 핵심 요약입니다\n\n## 본문" : `## ${req.agentId} 산출물`;
      return { text };
    },
  };
}

async function collect(fn: (emit: (e: OfficeEvent) => void) => Promise<void>) {
  const events: OfficeEvent[] = [];
  await fn((e) => events.push(e));
  const state = events.reduce((s, event, i) => officeReducer(s, { event, at: i }), INITIAL_STATE);
  return { events, state };
}

const signal = () => new AbortController().signal;

/** 가짜 점검 기능: 허용 목록 1개, 스캔은 실제 nmap 대신 예시 XML, 승인 여부는 테스트가 정함 */
function fakeScan(approve: boolean) {
  const log: Record<string, unknown>[] = [];
  const scanned: string[][] = [];
  const deps: ScanDeps = {
    loadTargets: async () => ({ targets: [{ name: "테스트망", target: "10.10.0.0/24" }], errors: [] }),
    runNmap: async (_p, targets) => {
      scanned.push(targets.map((t) => t.target));
      return SAMPLE_XML;
    },
    waitForDecision: async () => approve,
    audit: async (e) => void log.push(e),
  };
  return { deps, log, scanned };
}

beforeEach(() => {
  calls = [];
  plan = PLAN;
  failAgent = null;
  refuseAgent = null;
});

describe("runMission", () => {
  it("계획 → 조사 → 병렬 작성 → 취합 → 결재 요청 순으로 진행된다", async () => {
    const { events, state } = await collect((emit) => runMission("랜섬웨어 대응 점검해줘", emit, signal(), fakeBackend()));

    expect(events[0]).toMatchObject({ type: "mission_started", command: "랜섬웨어 대응 점검해줘" });
    expect(state.phase).toBe("awaiting_approval");
    expect(state.approval).toMatchObject({ title: "랜섬웨어 대응 준비 점검 보고서", summary: "핵심 요약입니다", round: 1 });
    expect(state.statuses).toMatchObject({ chief: "review", threat: "done", vuln: "done", compliance: "done", incident: "idle" });

    // 웹 검색은 위협정보 분석가와 컴플라이언스 담당만
    expect(calls.filter((c) => c.searchLimit).map((c) => c.agentId).sort()).toEqual(["compliance", "threat"]);
    expect(state.usage).toMatchObject({ searches: 2, tokens: 1500 * 5, costKrw: 0 });
    expect(state.quota).toMatchObject({ fiveHour: 0.2 });

    // 모델: 비서실장은 Opus, 실무자는 Sonnet
    expect(calls.find((c) => c.agentId === "chief")?.model).toBe("claude-opus-5-5");
    expect(calls.find((c) => c.agentId === "vuln")?.model).toBe("claude-sonnet-5-5");
    // 취합 단계에 두 팀원 초안이 모두 전달된다
    expect(calls.at(-1)?.user).toContain("vuln 산출물");
    expect(calls.at(-1)?.user).toContain("compliance 산출물");
  });

  it("담당자 한 명이 실패해도 나머지로 결재까지 간다", async () => {
    failAgent = "vuln";
    const { state } = await collect((emit) => runMission("점검", emit, signal(), fakeBackend()));
    expect(state.phase).toBe("awaiting_approval");
    expect(state.statuses.vuln).toBe("error");
    expect(state.logs.some((l) => l.from === "vuln" && l.text.startsWith("작성 실패"))).toBe(true);
  });

  it("위협정보 분석가가 거절하면 업무가 중단된다", async () => {
    refuseAgent = "threat";
    await expect(collect((emit) => runMission("점검", emit, signal(), fakeBackend()))).rejects.toThrow("사유: cyber");
  });

  it("API 방식에서는 비용 상한을 넘으면 다음 단계로 가지 않는다", async () => {
    await expect(collect((emit) => runMission("점검", emit, signal(), fakeBackend("api", 6000)))).rejects.toThrow(
      "비용 상한",
    );
    expect(calls).toHaveLength(1); // 계획 단계에서 멈춤
  });

  it("구독 방식에서는 비용 상한을 적용하지 않는다", async () => {
    const { state } = await collect((emit) => runMission("점검", emit, signal(), fakeBackend("subscription", 6000)));
    expect(state.phase).toBe("awaiting_approval");
  });
});

describe("runRevision", () => {
  it("반려 의견을 반영한 수정본을 다음 차수로 올린다", async () => {
    const { events } = await collect((emit) =>
      runRevision(
        { command: "점검", title: "보고서", report: "# 이전", comment: "출처 보강", round: 2, missionId: "m1" },
        emit,
        signal(),
        fakeBackend(),
      ),
    );
    expect(calls[0].user).toContain("출처 보강");
    expect(events.at(-1)).toMatchObject({
      type: "approval_requested",
      approval: { id: "m1-2", title: "보고서 (수정 1차)", round: 2 },
    });
  });
});

describe("시스템 점검(스캔)", () => {
  const scanPlan = { ...PLAN, scan_targets: ["테스트망"], scan_profile: "service", scan_reason: "열린 포트 확인" };

  it("팀장 승인 후에만 스캔하고, AI에게는 실제 IP 대신 별칭만 보낸다", async () => {
    plan = scanPlan;
    const f = fakeScan(true);
    const { events, state } = await collect((emit) =>
      runMission("10.10.0.0/24 대역 포트 점검해줘 (10.10.0.1 포함)", emit, signal(), fakeBackend(), { scanDeps: f.deps }),
    );

    const types = events.map((e) => e.type);
    expect(types.indexOf("scan_approval_requested")).toBeLessThan(types.indexOf("scan_resolved"));
    expect(f.scanned).toEqual([["10.10.0.0/24"]]);
    expect(f.log.map((e) => e.type)).toEqual(["scan_requested", "scan_approved", "scan_completed"]);

    // AI 호출 어디에도 실제 IP·호스트 이름이 없음
    const sent = calls.map((c) => c.user).join("\n");
    expect(sent).not.toMatch(/10\.10\.0\.|gw\.corp\.local/);
    expect(sent).toContain("테스트망 대역 포트 점검해줘");
    expect(calls.find((c) => c.agentId === "vuln")?.user).toContain("| 22/tcp | open | ssh | OpenSSH 8.9p1 Ubuntu |");

    // 별칭 대응표는 이 PC에서만 보고서 부록으로
    expect(state.approval?.appendix).toContain("| 테스트망 #1 | 10.10.0.1 |");
    expect(state.approval?.content).not.toContain("10.10.0.1");
    // 보고서 결재에 앞선 스캔 실행 승인 결과가 함께 실림
    expect(state.approval?.scan).toEqual({ decision: "approved", targets: ["테스트망"], profileLabel: "서비스 버전 확인" });
  });

  it("팀장이 승인하지 않으면 스캔하지 않고 그 사실을 담당자에게 알린다", async () => {
    plan = scanPlan;
    const f = fakeScan(false);
    const { state } = await collect((emit) => runMission("테스트망 점검", emit, signal(), fakeBackend(), { scanDeps: f.deps }));
    expect(f.scanned).toEqual([]);
    expect(f.log.map((e) => e.type)).toEqual(["scan_requested", "scan_rejected"]);
    expect(calls.find((c) => c.agentId === "vuln")?.user).toContain("팀장이 스캔 실행을 승인하지 않아");
    expect(state.approval?.scan).toEqual({ decision: "rejected", targets: ["테스트망"], profileLabel: "서비스 버전 확인" });
    expect(state.phase).toBe("awaiting_approval");
  });

  it("허용 목록에 없는 대상은 승인 요청 없이 거부한다", async () => {
    plan = { ...scanPlan, scan_targets: ["모르는 서버"] };
    const f = fakeScan(true);
    const { events } = await collect((emit) => runMission("점검", emit, signal(), fakeBackend(), { scanDeps: f.deps }));
    expect(events.some((e) => e.type === "scan_approval_requested")).toBe(false);
    expect(f.scanned).toEqual([]);
  });

  it("첨부한 nmap 결과는 승인 없이 분석만 하고, 취약점 점검 담당을 자동 배정한다", async () => {
    plan = { ...PLAN, assignments: [{ agent: "awareness", task: "안내문" }] };
    const f = fakeScan(true);
    const { events, state } = await collect((emit) =>
      runMission("첨부 결과 분석해줘", emit, signal(), fakeBackend(), { scanXml: SAMPLE_XML, scanDeps: f.deps }),
    );
    expect(state.approval?.scan).toEqual({ decision: "uploaded", targets: ["테스트망 #1", "테스트망 #2"] });
    expect(events.some((e) => e.type === "scan_approval_requested")).toBe(false);
    expect(f.scanned).toEqual([]);
    expect(f.log.map((e) => e.type)).toEqual(["upload_analyzed"]);
    const vuln = calls.find((c) => c.agentId === "vuln");
    expect(vuln?.user).toContain("팀장이 첨부한 nmap 결과");
    expect(vuln?.user).not.toMatch(/10\.10\.0\./);
  });

  it("nmap 결과가 아닌 파일을 첨부하면 알기 쉬운 오류로 중단한다", async () => {
    const f = fakeScan(true);
    await expect(
      collect((emit) => runMission("분석", emit, signal(), fakeBackend(), { scanXml: "<html/>", scanDeps: f.deps })),
    ).rejects.toThrow("첨부한 파일을 읽을 수 없습니다");
  });

  it("승인 대기 중 업무를 중지하면 스캔하지 않고 '취소'로 기록한다", async () => {
    plan = scanPlan;
    const f = fakeScan(true);
    const ctrl = new AbortController();
    f.deps.waitForDecision = async () => {
      ctrl.abort();
      return false;
    };
    await expect(collect((emit) => runMission("테스트망 점검", emit, ctrl.signal, fakeBackend(), { scanDeps: f.deps }))).rejects.toThrow();
    expect(f.scanned).toEqual([]);
    expect(f.log.map((e) => e.type)).toEqual(["scan_requested", "scan_cancelled"]);
  });
});
