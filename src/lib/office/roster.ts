import type { Actor, AgentId, AgentProfile, AgentStatus, ModelTier } from "./types";

export const TEAM_NAME = "AI 정보보안팀";
export const LEAD_LABEL = "팀장";
/** 팀이 속한 조직. 직원 지시문의 공통 배경으로 쓰입니다. */
export const ORG_CONTEXT = "금융회사 정보보안팀";

export const AGENTS: AgentProfile[] = [
  {
    id: "chief",
    name: "AI 비서실장",
    summary: "업무 분배 · 결과 취합 · 최종 보고",
    expertise: ["지시 분석과 업무 분배", "팀원 결과물 취합·검토", "경영진 보고서 작성"],
    tier: "top",
    seat: { x: 50, y: 60 },
    color: "#a8522a",
    initial: "비",
    shortName: "비서실장",
  },
  {
    id: "threat",
    name: "AI 위협정보 분석가",
    summary: "위협 동향 · CVE · 보안 권고 수집",
    expertise: [
      "최신 사이버 위협 동향(랜섬웨어, 피싱, 공급망 공격 등)",
      "신규 취약점(CVE) 분석과 영향도 요약",
      "금융보안원·KISA·CISA 보안 권고문",
      "출처 명시와 신뢰도 표기",
    ],
    tier: "standard",
    seat: { x: 16, y: 30 },
    color: "#3c5a8a",
    initial: "위",
    shortName: "위협정보",
  },
  {
    id: "awareness",
    name: "AI 보안교육 담당",
    summary: "임직원 교육 · 공지 · 피싱 모의훈련",
    expertise: [
      "임직원 보안 인식 교육자료",
      "보안 공지문·뉴스레터·보안 수칙 안내",
      "피싱 메일 모의훈련 시나리오",
      "금융회사 임직원 대상 정보보호 교육 의무 이행",
    ],
    tier: "standard",
    seat: { x: 84, y: 30 },
    color: "#2f7068",
    initial: "교",
    shortName: "보안교육",
  },
  {
    id: "compliance",
    name: "AI 컴플라이언스 담당",
    summary: "전자금융·개인정보·신용정보 법규",
    expertise: [
      "전자금융거래법 및 전자금융감독규정",
      "개인정보 보호법 및 시행령·고시",
      "신용정보의 이용 및 보호에 관한 법률(신용정보법)",
      "정보통신망법, ISMS-P 인증 기준",
      "보안 정책·지침 문서, 감사·검사 대비 증적 목록",
    ],
    tier: "standard",
    seat: { x: 16, y: 76 },
    color: "#6b4c86",
    initial: "컴",
    shortName: "컴플라이언스",
  },
  {
    id: "incident",
    name: "AI 침해대응 담당",
    summary: "사고 대응 · 로그 분석 · 보고서",
    expertise: [
      "침해사고 대응 절차(플레이북)",
      "제공된 로그·알림 내용 분석",
      "사고 보고서·경위서 초안과 재발 방지 대책",
      "금융사고·개인(신용)정보 유출 시 신고·통지 절차 연계",
    ],
    tier: "standard",
    seat: { x: 84, y: 76 },
    color: "#a03b3b",
    initial: "침",
    shortName: "침해대응",
  },
  {
    id: "vuln",
    name: "AI 취약점 점검 담당",
    summary: "점검 체크리스트 · 위험도 · 조치 계획",
    expertise: [
      "시스템·웹·클라우드 보안 점검 체크리스트",
      "전자금융기반시설 취약점 분석·평가 대응",
      "점검 결과 정리와 위험도 평가",
      "조치 계획과 일정 관리",
    ],
    tier: "standard",
    seat: { x: 50, y: 90 },
    color: "#7a6a1f",
    initial: "취",
    shortName: "취약점 점검",
  },
];

export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<
  AgentId,
  AgentProfile
>;

export function actorName(actor: Actor): string {
  return actor === "lead" ? LEAD_LABEL : AGENT_BY_ID[actor].name;
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "대기",
  working: "작업 중",
  review: "검토 요청",
  done: "완료",
  error: "오류",
};

export const TIER_LABEL: Record<ModelTier, string> = {
  top: "Claude Opus 5.5 · 판단·취합용 고성능 모델",
  standard: "Claude Sonnet 5.5 · 실무 작성용 모델",
};
