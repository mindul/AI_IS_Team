import { targetContains } from "./targets";
import type { ScanResult, ScanTarget } from "./types";

const IPV4_ANY = /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g;

/**
 * 실제 IP·호스트 이름을 별칭으로 바꿉니다. 별칭 대응표는 이 PC에만 남고 AI에게는 별칭만 갑니다.
 * - 허용 목록의 단일 대상 → 등록한 이름 (예: "테스트 웹서버")
 * - 허용 대역 안의 호스트 → "이름 #1", "이름 #2" …
 * - 그 밖의 주소 → "호스트 #1" …
 */
export class Masker {
  private map = new Map<string, string>();
  private counters = new Map<string, number>();

  constructor(private targets: ScanTarget[]) {
    for (const t of targets) this.map.set(t.target.toLowerCase(), t.name);
  }

  alias(address: string): string {
    const key = address.toLowerCase();
    const known = this.map.get(key);
    if (known) return known;
    const range = this.targets.find((t) => t.target.includes("/") && targetContains(t.target, address));
    const base = range ? range.name : "호스트";
    const n = (this.counters.get(base) ?? 0) + 1;
    this.counters.set(base, n);
    const alias = `${base} #${n}`;
    this.map.set(key, alias);
    return alias;
  }

  /** 글 속의 등록 대상·IPv4 주소를 모두 별칭으로 바꿉니다 (팀장 지시문 등). */
  maskText(text: string): string {
    let out = text;
    // 긴 것부터 바꿔야 "10.0.0.1"이 "10.0.0.10"을 망가뜨리지 않음
    for (const t of [...this.targets].sort((a, b) => b.target.length - a.target.length)) {
      out = out.split(t.target).join(t.name);
    }
    return out.replace(IPV4_ANY, (ip) => this.alias(ip));
  }

  /** 별칭 → 실제 주소 대응표 (이 PC에서만 보고서 부록으로 붙임) */
  entries(): { alias: string; real: string }[] {
    return [...this.map].map(([real, alias]) => ({ alias, real })).filter((e) => e.alias !== e.real);
  }
}

/** AI에게 보낼 스캔 결과 요약 (별칭만, 원본 XML은 보내지 않음) */
export function resultToMarkdown(result: ScanResult, masker: Masker): string {
  if (result.hosts.length === 0) return "스캔 결과에 호스트가 없습니다.";
  return result.hosts
    .map((h) => {
      const name = masker.alias(h.address);
      const notable = h.ports.filter((p) => p.state !== "closed");
      const closed = h.ports.length - notable.length + (h.omitted.closed ?? 0);
      const omittedOther = Object.entries(h.omitted)
        .filter(([s]) => s !== "closed")
        .map(([s, n]) => `${s} ${n}개`);
      const lines = [`### ${name} (상태: ${h.status})`];
      if (notable.length === 0) lines.push("- 열려 있거나 필터링된 포트 없음");
      else {
        lines.push("| 포트 | 상태 | 서비스 | 제품·버전 |", "|---|---|---|---|");
        for (const p of notable) {
          const product = [p.product, p.version].filter(Boolean).join(" ") || "-";
          lines.push(`| ${p.port}/${p.protocol} | ${p.state} | ${p.service ?? "-"} | ${masker.maskText(product)} |`);
        }
      }
      lines.push(`- 닫힌 포트 ${closed}개${omittedOther.length ? `, 그 밖에 ${omittedOther.join(", ")}` : ""}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

/** 보고서 뒤에 이 PC에서만 붙이는 별칭 대응표 */
export function aliasAppendix(masker: Masker): string | undefined {
  const rows = masker.entries();
  if (rows.length === 0) return undefined;
  return [
    "## 부록: 점검 대상 별칭 대응표",
    "",
    "> 이 표는 AI에게 보내지 않고 이 PC에서만 보고서에 붙였습니다.",
    "",
    "| 별칭 | 실제 대상 |",
    "|---|---|",
    ...rows.map((r) => `| ${r.alias} | ${r.real} |`),
  ].join("\n");
}
