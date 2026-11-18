import type { ScanTarget, TargetList } from "./types";

const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);
const HOSTNAME = /^(?=.{1,253}$)[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
/** 한 대상이 너무 넓은 범위를 스캔하지 않도록 /24(256개) 보다 넓은 대역은 거부 */
export const MIN_PREFIX = 24;

export const isIPv4 = (s: string) => IPV4.test(s);

/** 대상 문자열 검증. 옵션처럼 보이는 값(-로 시작)이나 범위 표기는 모두 거부합니다. */
export function validateTarget(target: string): string | null {
  const t = target.trim();
  if (!t) return "대상이 비어 있습니다";
  if (t.startsWith("-")) return "대상은 -로 시작할 수 없습니다";
  const [ip, prefix, ...rest] = t.split("/");
  if (rest.length > 0) return "형식이 올바르지 않습니다";
  if (prefix !== undefined) {
    if (!isIPv4(ip)) return "대역(CIDR)은 IPv4로만 지정할 수 있습니다";
    const n = Number(prefix);
    if (!/^\d+$/.test(prefix) || n < MIN_PREFIX || n > 32) return `대역은 /${MIN_PREFIX}~/32만 허용합니다`;
    return null;
  }
  if (isIPv4(t)) return null;
  // 호스트 이름의 마지막 부분에는 글자가 있어야 합니다. "10.0.0.1-50" 같은 nmap 범위 표기를 막기 위함.
  const last = t.split(".").at(-1) ?? "";
  if (HOSTNAME.test(t) && /[a-zA-Z]/.test(last)) return null;
  return "IPv4, IPv4 대역(CIDR) 또는 호스트 이름만 쓸 수 있습니다";
}

/** 허용 목록 JSON을 검증해 올바른 항목과 오류 목록을 돌려줍니다. */
export function parseTargets(json: unknown): TargetList {
  const errors: string[] = [];
  const list = (json as { targets?: unknown })?.targets;
  if (!Array.isArray(list)) return { targets: [], errors: ['"targets" 배열이 없습니다'] };

  const targets: ScanTarget[] = [];
  const names = new Set<string>();
  list.forEach((item, i) => {
    const e = item as Partial<ScanTarget>;
    const name = typeof e?.name === "string" ? e.name.trim() : "";
    const target = typeof e?.target === "string" ? e.target.trim() : "";
    const where = `${i + 1}번째 항목`;
    if (!name || name.length > 40) return errors.push(`${where}: 이름은 1~40자로 지정하세요`);
    if (names.has(name)) return errors.push(`${where}: 이름 "${name}"이(가) 중복됩니다`);
    const problem = validateTarget(target);
    if (problem) return errors.push(`${where} (${name}): ${problem}`);
    names.add(name);
    targets.push({ name, target, ...(typeof e.note === "string" && e.note.trim() ? { note: e.note.trim() } : {}) });
  });
  const domains = (json as { internalDomains?: unknown }).internalDomains;
  const internalDomains = Array.isArray(domains)
    ? domains.filter((d): d is string => typeof d === "string" && HOSTNAME.test(d.trim().replace(/^\./, ""))).map((d) => d.trim())
    : [];
  return { targets, errors, ...(internalDomains.length ? { internalDomains } : {}) };
}

const toInt = (ip: string) => ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;

/** 주소가 대상(단일 IP·대역·호스트 이름)에 포함되는지 */
export function targetContains(target: string, address: string): boolean {
  if (!target.includes("/")) return target.toLowerCase() === address.toLowerCase();
  if (!isIPv4(address)) return false;
  const [base, p] = target.split("/");
  const prefix = Number(p);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (toInt(base) & mask) === (toInt(address) & mask);
}
