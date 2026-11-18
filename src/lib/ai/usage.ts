import { PRICING, USD_TO_KRW, WEB_SEARCH_USD_PER_1K } from "./config";

/** SDK 응답의 usage 중 비용 계산에 필요한 필드만 */
export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/**
 * 응답 1건의 토큰 수와 원화 비용을 계산합니다.
 * 캐시 쓰기는 입력 단가의 1.25배, 캐시 읽기는 0.1배로 계산합니다.
 */
export function costOf(model: string, usage: UsageLike): { tokens: number; costKrw: number } {
  const price = PRICING[model] ?? PRICING["claude-opus-5-5"];
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const searches = usage.server_tool_use?.web_search_requests ?? 0;

  const usd =
    (usage.input_tokens * price.input +
      cacheWrite * price.input * 1.25 +
      cacheRead * price.input * 0.1 +
      usage.output_tokens * price.output) /
      1_000_000 +
    (searches * WEB_SEARCH_USD_PER_1K) / 1000;

  return {
    tokens: usage.input_tokens + cacheWrite + cacheRead + usage.output_tokens,
    costKrw: usd * USD_TO_KRW,
  };
}
