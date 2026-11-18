/** 버튼 스타일 어휘. 같은 종류의 행동은 어디서나 같은 모양입니다. */
const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-bold transition-colors disabled:cursor-not-allowed";

export const btn = {
  /** 화면의 핵심 행동 (승인, 실행) */
  primary: `${base} bg-accent px-4 py-2 text-white enabled:hover:bg-accent-hover disabled:bg-sunken disabled:text-muted`,
  /** 스캔 실행 승인 — 보고서 승인(주황)과 구분되는 파랑 */
  scan: `${base} bg-scan px-4 py-2 text-white enabled:hover:bg-scan-hover disabled:bg-sunken disabled:text-muted`,
  /** 일반 행동 (반려, 닫기, 내려받기) */
  secondary: `${base} border border-line-strong bg-white px-3.5 py-2 text-ink hover:border-ink-2 disabled:opacity-45`,
  /** 되돌릴 수 없는 행동 확정 */
  danger: `${base} bg-danger px-3.5 py-2 text-white hover:bg-danger-hover`,
  /** 보조 텍스트 버튼 */
  ghost: `${base} px-2.5 py-1.5 font-semibold text-muted hover:bg-sunken hover:text-ink disabled:opacity-45`,
};
