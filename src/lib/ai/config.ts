import type { ModelTier } from "../office/types";

/** 직원 등급별 모델 */
export const MODEL_BY_TIER: Record<ModelTier, string> = {
  top: "claude-opus-5-5",
  standard: "claude-sonnet-5-5",
};

/**
 * 요금표 (USD / 100만 토큰). 2026-11 기준 Anthropic 공시 단가.
 * 요금이 바뀌면 여기만 고치면 됩니다.
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-4-8": { input: 5, output: 25 },
};

/** 웹 검색 단가 (USD / 1,000회) */
export const WEB_SEARCH_USD_PER_1K = 10;

/** 원화 환산용 환율 (추정치, 화면에는 "약 ○원"으로 표시) */
export const USD_TO_KRW = 1400;

/** 지시 1건당 비용 상한(원). 넘으면 다음 단계로 가지 않고 중단합니다. */
export const MISSION_COST_CAP_KRW = 5000;

/** 웹 검색 횟수 상한 (직원별, 1회 호출 기준) */
export const SEARCH_LIMIT = { threat: 5, compliance: 3 } as const;
