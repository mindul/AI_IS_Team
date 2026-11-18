import { XMLParser } from "fast-xml-parser";
import type { ScanHost, ScanPort, ScanResult } from "./types";

type Attrs = Record<string, unknown>;
const ARRAYS = new Set(["host", "port", "address", "hostname", "extraports"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name) => ARRAYS.has(name),
  // 외부 엔티티·DTD는 처리하지 않습니다 (업로드 파일 대비)
  processEntities: false,
});

const str = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : String(v));

/** nmap XML(-oX) 출력을 구조화합니다. nmap 결과가 아니면 오류를 던집니다. */
export function parseNmapXml(xml: string): ScanResult {
  let doc: { nmaprun?: Attrs & { host?: Attrs[] } };
  try {
    doc = parser.parse(xml);
  } catch {
    throw new Error("XML을 읽을 수 없습니다");
  }
  const run = doc.nmaprun;
  if (!run || typeof run !== "object") throw new Error("nmap XML 결과(-oX) 파일이 아닙니다");

  const hosts: ScanHost[] = (run.host ?? []).map((h) => {
    const addresses = (h.address as Attrs[] | undefined) ?? [];
    const ip = addresses.find((a) => a.addrtype === "ipv4" || a.addrtype === "ipv6") ?? addresses[0];
    const hostnames = ((h.hostnames as Attrs | undefined)?.hostname as Attrs[] | undefined) ?? [];
    const portsNode = (h.ports as Attrs | undefined) ?? {};
    const ports: ScanPort[] = ((portsNode.port as Attrs[] | undefined) ?? []).map((p) => {
      const svc = (p.service as Attrs | undefined) ?? {};
      return {
        protocol: String(p.protocol ?? "tcp"),
        port: Number(p.portid),
        state: String((p.state as Attrs | undefined)?.state ?? "unknown"),
        service: str(svc.name),
        product: str(svc.product),
        version: str([svc.version, svc.extrainfo].filter(Boolean).join(" ")),
      };
    });
    const omitted: Record<string, number> = {};
    for (const x of (portsNode.extraports as Attrs[] | undefined) ?? []) {
      const state = String(x.state ?? "unknown");
      omitted[state] = (omitted[state] ?? 0) + Number(x.count ?? 0);
    }
    return {
      address: String(ip?.addr ?? "알 수 없음"),
      hostname: str(hostnames[0]?.name),
      status: String((h.status as Attrs | undefined)?.state ?? "unknown"),
      ports,
      omitted,
    };
  });

  return { hosts, startedAt: str(run.startstr) };
}

export function summarize(result: ScanResult): { hostsUp: number; openPorts: number } {
  return {
    hostsUp: result.hosts.filter((h) => h.status === "up").length,
    openPorts: result.hosts.reduce((n, h) => n + h.ports.filter((p) => p.state === "open").length, 0),
  };
}
