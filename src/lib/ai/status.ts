/** /api/status 응답. 서버(selectBackend)와 화면(Office)이 같은 모양을 씁니다. */
export interface BackendStatus {
  live: boolean;
  kind: "subscription" | "api";
  /** 구독 요금제 이름 (pro, max …) */
  plan?: string;
  /** 사용할 수 없을 때 안내 문구 */
  hint?: string;
}
