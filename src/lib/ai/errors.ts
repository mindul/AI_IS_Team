import { AGENT_BY_ID } from "../office/roster";
import type { AgentId } from "../office/types";
import { MISSION_COST_CAP_KRW } from "./config";

/** 모델이 정책상 응답을 거절했을 때 */
export class AgentRefusalError extends Error {
  constructor(
    public agentId: AgentId,
    category?: string | null,
  ) {
    super(`${AGENT_BY_ID[agentId].name}이(가) 요청을 처리하지 않았습니다 (사유: ${category ?? "알 수 없음"})`);
  }
}

/** API 요금 방식에서 지시 1건 비용 상한 도달 */
export class CostCapError extends Error {
  constructor(spent: number) {
    super(
      `비용 상한(${MISSION_COST_CAP_KRW.toLocaleString("ko-KR")}원)에 도달했습니다 (현재 약 ${Math.round(spent).toLocaleString("ko-KR")}원)`,
    );
  }
}

/** 화면에 그대로 보여줄 수 있는 메시지를 가진 오류 (백엔드별 오류를 여기로 변환) */
export class UserFacingError extends Error {}
