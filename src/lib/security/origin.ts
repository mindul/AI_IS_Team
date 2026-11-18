/**
 * 이 앱은 팀장 PC 한 대에서만 쓰는 도구입니다. 그래서 API 요청을 두 가지로 확인합니다.
 * 1) Host: localhost·127.0.0.1·::1 (그리고 ALLOWED_HOSTS에 적은 이름)만 받습니다.
 *    DNS 리바인딩(공격자 도메인을 127.0.0.1로 돌려 브라우저가 이 앱을 읽게 하는 수법)을 막습니다.
 * 2) 데이터를 바꾸는 요청(POST·DELETE 등)은 Origin이 이 앱 자신이어야 합니다.
 *    다른 웹사이트가 팀장 브라우저를 통해 미션 실행·보고서 저장을 시키는 CSRF를 막습니다.
 */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** "localhost:3000" → "localhost", "[::1]:3000" → "[::1]" */
export function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

export function allowedHosts(extra = process.env.ALLOWED_HOSTS): Set<string> {
  const set = new Set(LOOPBACK);
  for (const h of (extra ?? "").split(",")) if (h.trim()) set.add(h.trim().toLowerCase());
  return set;
}

export interface RequestFacts {
  method: string;
  host: string | null;
  origin: string | null;
  /** 브라우저가 붙이는 요청 출처 구분 (same-origin, cross-site …) */
  fetchSite: string | null;
}

/** 거부 사유를 돌려줍니다. 통과하면 null */
export function checkRequest(r: RequestFacts, hosts = allowedHosts()): string | null {
  if (!r.host || !hosts.has(hostnameOf(r.host))) return "허용되지 않은 주소로 접속했습니다 (이 PC에서 localhost로 접속하세요)";
  if (SAFE_METHODS.has(r.method.toUpperCase())) return null;

  if (r.origin) {
    let originHost: string;
    try {
      originHost = new URL(r.origin).host.toLowerCase();
    } catch {
      return "요청 출처(Origin)가 올바르지 않습니다";
    }
    return originHost === r.host.trim().toLowerCase() ? null : "다른 사이트에서 보낸 요청은 처리하지 않습니다";
  }
  // Origin이 없을 때: 브라우저라면 Sec-Fetch-Site가 있으니 그것으로 판단, 둘 다 없으면 curl 같은 로컬 도구
  if (r.fetchSite && r.fetchSite !== "same-origin" && r.fetchSite !== "none") return "다른 사이트에서 보낸 요청은 처리하지 않습니다";
  return null;
}
