import "server-only";

/**
 * 스캔 승인 대기열. 업무가 진행 중인 요청은 팀장 결정이 올 때까지 기다리고,
 * /api/scans/[id]/decision 이 결정을 전달합니다. (개발 서버 재로딩에도 유지되도록 globalThis 사용)
 */
type Resolver = (approved: boolean) => void;
const store = ((globalThis as { __scanDecisions?: Map<string, Resolver> }).__scanDecisions ??= new Map());

/** 팀장 결정을 기다립니다. 시간 초과·중지 시 "미승인"으로 처리합니다. */
export function waitForDecision(id: string, signal: AbortSignal, timeoutMs = 15 * 60_000): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (approved: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      store.delete(id);
      resolve(approved);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMs);
    signal.addEventListener("abort", onAbort, { once: true });
    store.set(id, finish);
  });
}

/** 결정 전달. 기다리는 요청이 없으면 false */
export function resolveDecision(id: string, approved: boolean): boolean {
  const r = store.get(id);
  if (!r) return false;
  r(approved);
  return true;
}
