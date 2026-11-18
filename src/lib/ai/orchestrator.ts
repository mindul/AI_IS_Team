import "server-only";

import * as z from "zod/v4";
import { AGENT_BY_ID } from "../office/roster";
import type { AgentId, OfficeEvent } from "../office/types";
import { audit } from "../scan/audit";
import { waitForDecision } from "../scan/decisions";
import { Masker, aliasAppendix, resultToMarkdown } from "../scan/mask";
import { parseNmapXml, summarize } from "../scan/parse";
import { PROFILES } from "../scan/profiles";
import { loadTargets, runNmap } from "../scan/runner";
import type { ScanOutcome, ScanProfileId, ScanRequest, ScanTarget, TargetList } from "../scan/types";
import type { Backend, Effort } from "./backend";
import { MISSION_COST_CAP_KRW, MODEL_BY_TIER, SEARCH_LIMIT } from "./config";
import { AgentRefusalError, CostCapError, UserFacingError } from "./errors";
import {
  CHIEF_COMPILE_SYSTEM,
  CHIEF_PLAN_SYSTEM,
  CHIEF_REVISE_SYSTEM,
  THREAT_SYSTEM,
  writerSystem,
} from "./prompts";
import { summaryOf } from "./report";
import { getBackend } from "./selectBackend";

type Writer = Exclude<AgentId, "chief" | "threat">;
type Emit = (event: OfficeEvent) => void;

const WRITERS = ["vuln", "incident", "compliance", "awareness"] as const;

/** 점검(스캔)에 필요한 바깥 기능. 테스트에서는 가짜로 바꿔 끼웁니다. */
export interface ScanDeps {
  loadTargets: () => Promise<TargetList>;
  runNmap: (profile: ScanProfileId, targets: ScanTarget[], signal: AbortSignal) => Promise<string>;
  waitForDecision: (scanId: string, signal: AbortSignal) => Promise<boolean>;
  audit: (entry: Record<string, unknown>) => Promise<void>;
}

const defaultScanDeps: ScanDeps = { loadTargets, runNmap, waitForDecision, audit };

/** 비서실장 업무 계획 (구조화 출력). 검증은 zod, 모델에는 JSON Schema를 줍니다. */
const PlanSchema = z.object({
  understanding: z.string(),
  report_title: z.string(),
  research_focus: z.array(z.string()).min(1),
  assignments: z.array(z.object({ agent: z.enum(WRITERS), task: z.string() })).min(1),
  scan_targets: z.array(z.string()),
  scan_profile: z.enum(["quick", "service"]),
  scan_reason: z.string(),
});
type Plan = z.infer<typeof PlanSchema>;

function planJsonSchema(targetNames: string[]) {
  return {
    type: "object",
    properties: {
      understanding: { type: "string", description: "지시를 어떻게 이해했는지 한두 문장" },
      report_title: { type: "string", description: "최종 보고서 제목" },
      research_focus: { type: "array", items: { type: "string" }, description: "위협정보 분석가가 조사할 질문 2~4개" },
      assignments: {
        type: "array",
        description: "배정할 팀원 1~4명",
        items: {
          type: "object",
          properties: {
            agent: { type: "string", enum: [...WRITERS] },
            task: { type: "string", description: "해당 팀원이 작성할 산출물과 범위" },
          },
          required: ["agent", "task"],
          additionalProperties: false,
        },
      },
      scan_targets: {
        type: "array",
        description: "팀장이 점검을 지시한 경우에만, 허용 목록의 대상 이름. 아니면 빈 배열",
        items: targetNames.length > 0 ? { type: "string", enum: targetNames } : { type: "string" },
      },
      scan_profile: { type: "string", enum: ["quick", "service"] },
      scan_reason: { type: "string", description: "스캔이 필요한 이유 한 문장 (스캔하지 않으면 빈 문자열)" },
    },
    required: ["understanding", "report_title", "research_focus", "assignments", "scan_targets", "scan_profile", "scan_reason"],
    additionalProperties: false,
  };
}

const today = () =>
  new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });

/** 한 지시(또는 수정 요청)를 처리하는 동안의 공통 상태: 이벤트 발행, 사용량 집계, 중단 신호 */
class MissionContext {
  private spentKrw = 0;

  constructor(
    readonly backend: Backend,
    readonly emit: Emit,
    readonly signal: AbortSignal,
  ) {}

  /** 다음 단계로 넘어가기 전에 중단 여부와 (API 방식이면) 비용 상한을 확인합니다. */
  checkpoint() {
    this.signal.throwIfAborted();
    if (this.backend.kind === "api" && this.spentKrw >= MISSION_COST_CAP_KRW) throw new CostCapError(this.spentKrw);
  }

  async run(opts: {
    agentId: AgentId;
    system: string;
    user: string;
    effort: Effort;
    maxTokens: number;
    searchLimit?: number;
    jsonSchema?: Record<string, unknown>;
  }) {
    return this.backend.run(
      { ...opts, model: MODEL_BY_TIER[AGENT_BY_ID[opts.agentId].tier] },
      {
        onSearch: (query) => this.emit({ type: "search", agentId: opts.agentId, query }),
        onUsage: ({ tokens, costKrw }) => {
          this.spentKrw += costKrw;
          this.emit({ type: "usage", tokens, costKrw: Math.round(costKrw * 10) / 10 });
        },
        onQuota: (quota) => this.emit({ type: "quota", quota }),
      },
      this.signal,
    );
  }

  async plan(command: string, targets: ScanTarget[], hasUpload: boolean): Promise<Plan> {
    const scope =
      targets.length > 0
        ? `점검(스캔) 허용 목록 — 팀장이 등록한 대상 (이 이름으로만 지정 가능):\n${targets
            .map((t) => `- ${t.name}${t.note ? `: ${t.note}` : ""}`)
            .join("\n")}`
        : "점검(스캔) 허용 목록이 비어 있어 스캔할 수 없습니다 (scan_targets는 빈 배열).";
    const upload = hasUpload
      ? "\n\n팀장이 nmap 결과 파일을 첨부했습니다. 새로 스캔하지 말고(scan_targets는 빈 배열) 취약점 점검 담당에게 결과 분석을 배정하세요."
      : "";
    const res = await this.run({
      agentId: "chief",
      system: CHIEF_PLAN_SYSTEM,
      user: `오늘 날짜: ${today()}\n\n팀장 지시: ${command}\n\n${scope}${upload}`,
      effort: "medium",
      maxTokens: 16000,
      jsonSchema: planJsonSchema(targets.map((t) => t.name)),
    });
    const parsed = PlanSchema.safeParse(res.structured);
    if (!parsed.success) throw new UserFacingError("비서실장이 업무 계획을 만들지 못했습니다");

    // 같은 팀원이 두 번 배정되면 합치고, 최대 4명으로 제한
    const merged = new Map<Writer, string>();
    for (const a of parsed.data.assignments)
      merged.set(a.agent, merged.has(a.agent) ? `${merged.get(a.agent)}\n${a.task}` : a.task);
    return { ...parsed.data, assignments: [...merged].slice(0, 4).map(([agent, task]) => ({ agent, task })) };
  }
}

/** 오류를 화면에 보여줄 한 줄 메시지로 바꿉니다. */
export function describeError(err: unknown): { reason: string; agentId?: AgentId } {
  if (err instanceof AgentRefusalError) return { reason: err.message, agentId: err.agentId };
  if (err instanceof CostCapError || err instanceof UserFacingError) return { reason: err.message };
  if (err instanceof Error && err.name === "AbortError") return { reason: "팀장이 업무를 중지했습니다" };
  return { reason: err instanceof Error ? err.message : String(err) };
}

/**
 * 시스템 점검 단계. 실제 스캔은 팀장 승인 후에만, 허용 목록 대상·고정 옵션으로 실행합니다.
 * 돌려주는 글은 별칭만 담고 있어 AI에게 보내도 됩니다.
 */
async function scanStep(
  input: { missionId: string; command: string; plan: Plan; targets: ScanTarget[]; scanXml?: string },
  masker: Masker,
  emit: Emit,
  signal: AbortSignal,
  deps: ScanDeps,
): Promise<{ section: string; outcome?: ScanOutcome } | undefined> {
  const { missionId, plan, targets, scanXml } = input;

  // (가) 첨부된 결과 분석 — 실제 스캔이 아니므로 승인 단계 없음
  if (scanXml) {
    let result;
    try {
      result = parseNmapXml(scanXml);
    } catch (err) {
      throw new UserFacingError(`첨부한 파일을 읽을 수 없습니다: ${(err as Error).message}`);
    }
    const s = summarize(result);
    emit({ type: "log", from: "chief", text: `첨부된 nmap 결과 확인: 호스트 ${result.hosts.length}개(응답 ${s.hostsUp}), 열린 포트 ${s.openPorts}개` });
    await deps.audit({ type: "upload_analyzed", missionId, hosts: result.hosts.length, openPorts: s.openPorts });
    const section = `## 팀장이 첨부한 nmap 결과${result.startedAt ? ` (${result.startedAt})` : ""}\n\n${resultToMarkdown(result, masker)}`;
    return { section, outcome: { decision: "uploaded", targets: result.hosts.map((h) => masker.alias(h.address)) } };
  }

  if (plan.scan_targets.length === 0) return undefined;

  // (나) 실제 스캔 — 팀장 승인 필수
  const chosen = targets.filter((t) => plan.scan_targets.includes(t.name));
  if (chosen.length === 0) {
    emit({ type: "log", from: "chief", text: "요청한 점검 대상이 허용 목록에 없어 스캔하지 않습니다 (config/scan-targets.json)" });
    return { section: "(점검 대상이 허용 목록에 없어 스캔하지 않았습니다.)" };
  }
  const profile = PROFILES[plan.scan_profile];
  const scan: ScanRequest = {
    id: crypto.randomUUID().slice(0, 8),
    targets: chosen,
    profile: plan.scan_profile,
    profileLabel: profile.label,
    profileDesc: profile.desc,
    reason: plan.scan_reason || "팀장 지시에 따른 점검",
  };
  await deps.audit({ type: "scan_requested", missionId, scanId: scan.id, targets: chosen, profile: scan.profile, reason: scan.reason });
  emit({ type: "scan_approval_requested", scan });

  const approved = await deps.waitForDecision(scan.id, signal);
  if (signal.aborted) {
    // 결정 없이 업무가 중지된 경우도 감사 기록에 남깁니다.
    await deps.audit({ type: "scan_cancelled", missionId, scanId: scan.id });
    signal.throwIfAborted();
  }
  emit({ type: "scan_resolved", decision: approved ? "approved" : "rejected" });
  await deps.audit({ type: approved ? "scan_approved" : "scan_rejected", missionId, scanId: scan.id });
  const outcomeBase = { targets: chosen.map((t) => t.name), profileLabel: profile.label };
  if (!approved)
    return {
      section: "(팀장이 스캔 실행을 승인하지 않아 실제 점검 결과는 없습니다.)",
      outcome: { decision: "rejected", ...outcomeBase },
    };

  const names = chosen.map((t) => t.name).join(", ");
  emit({ type: "agent_status", agentId: "vuln", status: "working" });
  emit({ type: "log", from: "vuln", text: `스캔 시작: ${names} — ${profile.label}` });
  const startedAt = Date.now();
  let xml: string;
  try {
    xml = await deps.runNmap(scan.profile, chosen, signal);
  } catch (err) {
    if (signal.aborted) throw err;
    const msg = (err as Error).message;
    await deps.audit({ type: "scan_failed", missionId, scanId: scan.id, error: msg });
    emit({ type: "log", from: "vuln", text: `스캔 실패 — ${msg}` });
    return { section: `(스캔을 실행하지 못했습니다: ${msg})`, outcome: { decision: "approved", ...outcomeBase } };
  }
  const result = parseNmapXml(xml);
  const s = summarize(result);
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  await deps.audit({ type: "scan_completed", missionId, scanId: scan.id, hostsUp: s.hostsUp, openPorts: s.openPorts, seconds });
  emit({ type: "log", from: "vuln", text: `스캔 완료: 응답 호스트 ${s.hostsUp}개, 열린 포트 ${s.openPorts}개 (${seconds}초)` });
  return {
    section: `## 팀장 승인 점검 결과 — ${profile.label}\n- 범위: ${names}\n- 방식: ${profile.desc}\n\n${resultToMarkdown(result, masker)}`,
    outcome: { decision: "approved", ...outcomeBase },
  };
}

/** 팀장 지시 1건: 계획 → (점검 승인·스캔) → 위협정보 조사 → 담당자 병렬 작성 → 취합 → 결재 요청 */
export async function runMission(
  rawCommand: string,
  emit: Emit,
  signal: AbortSignal,
  backend: Backend = getBackend(),
  opts: { scanXml?: string; scanDeps?: ScanDeps } = {},
): Promise<void> {
  const deps = opts.scanDeps ?? defaultScanDeps;
  const ctx = new MissionContext(backend, emit, signal);
  const missionId = crypto.randomUUID().slice(0, 8);
  emit({ type: "mission_started", missionId, command: rawCommand });

  // 등록된 점검 대상·IP는 AI에게 별칭으로만 전달합니다.
  const { targets, errors, internalDomains } = await deps.loadTargets();
  if (errors.length) emit({ type: "log", from: "chief", text: `점검 허용 목록 오류 (해당 항목 제외): ${errors.join(" / ")}` });
  const masker = new Masker(targets, internalDomains);
  const command = masker.maskText(rawCommand);

  // 1. 비서실장: 업무 계획
  emit({ type: "agent_status", agentId: "chief", status: "working" });
  const plan = await ctx.plan(command, targets, Boolean(opts.scanXml));
  const names = plan.assignments.map((a) => AGENT_BY_ID[a.agent].name.replace("AI ", ""));
  emit({ type: "log", from: "chief", text: `${plan.understanding} — 담당: 위협정보 분석가, ${names.join(", ")}` });
  ctx.checkpoint();

  // 2. 시스템 점검 (첨부 결과 분석 또는 팀장 승인 스캔)
  const scanResult = await scanStep({ missionId, command, plan, targets, scanXml: opts.scanXml }, masker, emit, signal, deps);
  const scanSection = scanResult?.section;
  if (scanSection && !plan.assignments.some((a) => a.agent === "vuln")) {
    plan.assignments.unshift({ agent: "vuln", task: "점검(스캔) 결과 분석: 대상·포트별 위험도와 조치 권고" });
    plan.assignments = plan.assignments.slice(0, 4);
  }
  ctx.checkpoint();

  // 3. 위협정보 분석가: 웹 검색 조사
  emit({ type: "handoff", from: "chief", to: "threat", summary: `조사 요청: ${plan.research_focus.join(" / ")}` });
  emit({ type: "agent_status", agentId: "threat", status: "working" });
  const { text: briefing } = await ctx.run({
    agentId: "threat",
    system: THREAT_SYSTEM,
    user: `오늘 날짜: ${today()}\n\n팀장 지시: ${command}\n\n조사 질문:\n${plan.research_focus.map((q) => `- ${q}`).join("\n")}`,
    effort: "medium",
    maxTokens: 32000,
    searchLimit: SEARCH_LIMIT.threat,
  });
  emit({ type: "agent_status", agentId: "threat", status: "done" });
  emit({ type: "handoff", from: "threat", to: "chief", summary: "위협정보 브리핑 전달" });
  ctx.checkpoint();

  // 4. 담당자들: 병렬 작성. 한 명이 실패해도 나머지 초안으로 계속 진행합니다 (중지·비용 상한은 전체 중단).
  for (const a of plan.assignments) {
    emit({ type: "handoff", from: "chief", to: a.agent, summary: a.task });
    emit({ type: "agent_status", agentId: a.agent, status: "working" });
  }
  const results = await Promise.all(
    plan.assignments.map(async (a) => {
      try {
        const scanPart = a.agent === "vuln" && scanSection ? `\n\n--- 점검(스캔) 결과 ---\n${scanSection}` : "";
        const { text: draft } = await ctx.run({
          agentId: a.agent,
          system: writerSystem(a.agent),
          user: `오늘 날짜: ${today()}\n\n팀장 지시: ${command}\n\n비서실장 배정 업무: ${a.task}${scanPart}\n\n--- 위협정보 브리핑 ---\n${briefing}`,
          effort: "medium",
          maxTokens: 32000,
          searchLimit: a.agent === "compliance" ? SEARCH_LIMIT.compliance : undefined,
        });
        emit({ type: "agent_status", agentId: a.agent, status: "review" });
        emit({ type: "log", from: a.agent, text: "초안 작성 완료 → 검토 요청" });
        return { agent: a.agent, draft };
      } catch (err) {
        if (signal.aborted || err instanceof CostCapError) throw err;
        emit({ type: "agent_status", agentId: a.agent, status: "error" });
        emit({ type: "log", from: a.agent, text: `작성 실패 — ${describeError(err).reason}` });
        return null;
      }
    }),
  );
  const drafts = results.filter((d) => d !== null);
  if (drafts.length === 0) throw new UserFacingError("담당 팀원 전원이 초안을 작성하지 못했습니다");
  ctx.checkpoint();

  // 5. 비서실장: 취합
  emit({ type: "log", from: "chief", text: "결과 취합 · 최종 보고서 작성 중" });
  const sections = drafts.map((d) => `--- ${AGENT_BY_ID[d.agent].name} 초안 ---\n${d.draft}`).join("\n\n");
  const scanForChief = scanSection ? `\n\n--- 점검(스캔) 결과 원자료 ---\n${scanSection}` : "";
  const { text: report } = await ctx.run({
    agentId: "chief",
    system: CHIEF_COMPILE_SYSTEM,
    user: `오늘 날짜: ${today()}\n\n팀장 지시: ${command}\n보고서 제목(안): ${plan.report_title}${scanForChief}\n\n--- 위협정보 분석가 브리핑 ---\n${briefing}\n\n${sections}`,
    effort: "medium",
    maxTokens: 64000,
  });
  for (const d of drafts) emit({ type: "agent_status", agentId: d.agent, status: "done" });

  // 6. 결재 요청 (별칭 대응표는 이 PC에서만 부록으로 붙임)
  emit({ type: "agent_status", agentId: "chief", status: "review" });
  emit({
    type: "approval_requested",
    approval: {
      id: `${missionId}-1`,
      title: plan.report_title,
      summary: summaryOf(report),
      content: report,
      round: 1,
      contributors: ["threat", ...drafts.map((d) => d.agent)],
      appendix: aliasAppendix(masker),
      scan: scanResult?.outcome,
    },
  });
}

/** 반려 의견을 반영한 수정본 작성 */
export async function runRevision(
  input: {
    command: string;
    title: string;
    report: string;
    comment: string;
    round: number;
    missionId: string;
    contributors?: AgentId[];
    appendix?: string;
    scan?: ScanOutcome;
  },
  emit: Emit,
  signal: AbortSignal,
  backend: Backend = getBackend(),
  scanDeps: Pick<ScanDeps, "loadTargets"> = defaultScanDeps,
): Promise<void> {
  const ctx = new MissionContext(backend, emit, signal);
  const list = await scanDeps.loadTargets();
  const masker = new Masker(list.targets, list.internalDomains);
  const note = masker.maskText(input.comment.trim() || "전반적으로 보완해 주세요");

  emit({ type: "agent_status", agentId: "chief", status: "working" });
  emit({ type: "log", from: "chief", text: `반려 의견 반영 중: ${input.comment.trim() || "전반적으로 보완"}` });
  const { text: report } = await ctx.run({
    agentId: "chief",
    system: CHIEF_REVISE_SYSTEM,
    user: `오늘 날짜: ${today()}\n\n팀장 원래 지시: ${masker.maskText(input.command)}\n\n팀장 반려 의견: ${note}\n\n--- 반려된 보고서 ---\n${masker.maskText(input.report)}`,
    effort: "medium",
    maxTokens: 64000,
  });
  emit({ type: "log", from: "chief", text: "보고서 수정 완료" });
  emit({ type: "agent_status", agentId: "chief", status: "review" });

  const baseTitle = input.title.replace(/ \(수정 \d+차\)$/, "");
  emit({
    type: "approval_requested",
    approval: {
      id: `${input.missionId}-${input.round}`,
      title: `${baseTitle} (수정 ${input.round - 1}차)`,
      summary: `반려 의견 반영: ${input.comment.trim() || "전반적으로 보완"}`,
      content: report,
      round: input.round,
      contributors: input.contributors,
      appendix: input.appendix,
      scan: input.scan,
    },
  });
}
