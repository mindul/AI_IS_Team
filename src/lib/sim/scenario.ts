import type { AgentId, OfficeEvent } from "../office/types";

/** 직전 이벤트로부터 delay(ms) 뒤에 발생하는 이벤트 */
export interface TimedEvent {
  delay: number;
  event: OfficeEvent;
}

type Writer = Exclude<AgentId, "chief" | "threat">;

/** 담당자 배정 키워드. 위협정보 분석가는 키워드와 상관없이 항상 먼저 참여합니다. */
const ROUTES: { agent: Writer; pattern: RegExp }[] = [
  { agent: "vuln", pattern: /점검|진단|체크리스트|조치|위험도|취약점\s*분석|모의해킹/ },
  { agent: "incident", pattern: /사고|침해|대응|로그|유출|경위서|플레이북|탐지/ },
  { agent: "compliance", pattern: /ISMS|개인정보|신용정보|전자금융|법|규정|정책|지침|감사|검사|인증|컴플라이언스/i },
  { agent: "awareness", pattern: /교육|훈련|안내문|공지|뉴스레터|피싱|수칙/ },
];

const TASKS: Record<Writer, { ask: string; done: string; part: string }> = {
  vuln: { ask: "점검 체크리스트·조치 계획 작성 요청", done: "점검 체크리스트 초안 작성 완료 → 검토 요청", part: "점검 체크리스트" },
  incident: { ask: "대응 절차(플레이북) 작성 요청", done: "대응 플레이북 초안 작성 완료 → 검토 요청", part: "대응 플레이북" },
  compliance: { ask: "관련 법규(전자금융·개인정보·신용정보) 검토 요청", done: "법규 검토 의견 작성 완료 → 검토 요청", part: "법규 검토 의견" },
  awareness: { ask: "임직원 안내문·교육자료 작성 요청", done: "임직원 안내문 초안 작성 완료 → 검토 요청", part: "임직원 안내문" },
};

const AGENT_LABEL: Record<Writer, string> = {
  vuln: "취약점 점검",
  incident: "침해대응",
  compliance: "컴플라이언스",
  awareness: "보안교육",
};

/** 지시문에서 "~해줘" 같은 요청 어미를 떼어 주제만 남깁니다. */
export function topicOf(command: string): string {
  const topic = command
    .trim()
    .replace(/[.!?。]+$/, "")
    .replace(/\s*(을|를)?\s*(만들어|정리해|작성해|준비해|조사해|분석해|알려|찾아|써)\s*(줘|주세요|줄래|봐)?$/, "")
    .replace(/\s*(해\s*줘|해\s*주세요|해봐)$/, "")
    .trim();
  return topic || command.trim();
}

/** 지시 내용에 맞는 실무 담당자를 고릅니다(위협정보 분석가는 항상 참여). */
export function pickWriters(command: string): Writer[] {
  const matched = ROUTES.filter((r) => r.pattern.test(command)).map((r) => r.agent);
  return matched.length > 0 ? matched.slice(0, 3) : ["vuln", "incident"];
}

export function buildMission(missionId: string, command: string): TimedEvent[] {
  const topic = topicOf(command);
  const writers = pickWriters(command);
  const team = ["위협정보", ...writers.map((w) => AGENT_LABEL[w])].join(", ");
  const ev: TimedEvent[] = [];
  const add = (delay: number, event: OfficeEvent) => ev.push({ delay, event });

  add(0, { type: "mission_started", missionId, command });
  add(500, { type: "agent_status", agentId: "chief", status: "working" });
  add(1400, { type: "log", from: "chief", text: `지시 분석 완료 — 담당: ${team}` });
  add(0, { type: "usage", tokens: 1850, costKrw: 9 });

  add(900, { type: "handoff", from: "chief", to: "threat", summary: `“${topic}” 위협 동향 조사 요청` });
  add(300, { type: "agent_status", agentId: "threat", status: "working" });
  add(1500, { type: "search", agentId: "threat", query: `${topic} 최신 위협 동향` });
  add(1600, { type: "search", agentId: "threat", query: `${topic} 금융보안원 · KISA 보안 권고` });
  add(0, { type: "usage", tokens: 4200, costKrw: 21 });
  add(1500, { type: "log", from: "threat", text: "위협 정보 8건 정리 완료 (출처 링크 포함)" });
  add(400, { type: "handoff", from: "threat", to: "chief", summary: "조사 결과 전달" });
  add(0, { type: "agent_status", agentId: "threat", status: "done" });

  for (const w of writers) {
    add(700, { type: "handoff", from: "chief", to: w, summary: TASKS[w].ask });
    add(200, { type: "agent_status", agentId: w, status: "working" });
    if (w === "compliance") {
      add(1200, { type: "search", agentId: "compliance", query: "전자금융감독규정 · 개인정보 보호법 · 신용정보법 최신 개정" });
    }
  }
  for (const w of writers) {
    add(2200, { type: "log", from: w, text: TASKS[w].done });
    add(0, { type: "agent_status", agentId: w, status: "review" });
    add(0, { type: "usage", tokens: 2600, costKrw: 13 });
  }

  add(900, { type: "log", from: "chief", text: "결과 취합 · 최종 보고서 작성 중" });
  add(0, { type: "usage", tokens: 3100, costKrw: 16 });
  for (const w of writers) add(300, { type: "agent_status", agentId: w, status: "done" });
  add(1500, { type: "agent_status", agentId: "chief", status: "review" });
  add(0, {
    type: "approval_requested",
    approval: {
      id: `${missionId}-1`,
      title: `${topic} — 최종 보고서`,
      summary: `위협 정보 8건 + ${writers.map((w) => TASKS[w].part).join(", ")} 취합`,
      content: sampleReport(topic, writers.map((w) => TASKS[w].part)),
      round: 1,
      contributors: ["threat", ...writers],
    },
  });
  return ev;
}

/** 반려 후 비서실장이 의견을 반영해 다시 올리는 흐름. round는 2부터(1차 결재가 1). */
export function buildRework(
  missionId: string,
  round: number,
  comment: string,
  title: string,
  contributors?: AgentId[],
): TimedEvent[] {
  const ev: TimedEvent[] = [];
  const add = (delay: number, event: OfficeEvent) => ev.push({ delay, event });
  const note = comment.trim() || "보완 요청";
  const baseTitle = title.replace(/ \(수정 \d+차\)$/, "");

  add(400, { type: "agent_status", agentId: "chief", status: "working" });
  add(1000, { type: "log", from: "chief", text: `반려 의견 반영 계획 수립: ${note}` });
  add(0, { type: "usage", tokens: 1400, costKrw: 7 });
  add(1800, { type: "log", from: "chief", text: "보고서 수정 완료" });
  add(0, { type: "usage", tokens: 2300, costKrw: 12 });
  add(600, { type: "agent_status", agentId: "chief", status: "review" });
  add(0, {
    type: "approval_requested",
    approval: {
      id: `${missionId}-${round}`,
      title: `${baseTitle} (수정 ${round - 1}차)`,
      summary: `반려 의견 반영: ${note}`,
      content: `${sampleReport(baseTitle.replace(/ — 최종 보고서$/, ""), [])}\n\n## 수정 사항\n- ${note}`,
      round,
      contributors,
    },
  });
  return ev;
}

/** 시뮬레이션용 보고서 본문. 실제 내용이 아님을 분명히 표시합니다. */
function sampleReport(topic: string, parts: string[]): string {
  return [
    `# ${topic} — 최종 보고서 (시뮬레이션)`,
    "",
    "> 시뮬레이션 모드에서 만든 예시 문서입니다. 실제 조사 결과가 아닙니다.",
    "",
    "## 요약",
    `- ${topic}에 대한 위협 동향을 조사하고 담당별 초안을 취합했습니다.`,
    "",
    "## 포함된 산출물",
    ...["위협 정보 요약", ...parts].map((p) => `- ${p}`),
  ].join("\n");
}
