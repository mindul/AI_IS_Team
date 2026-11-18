import type { ScanProfileId } from "./types";

/**
 * 허용된 스캔 종류. AI는 이 중 하나를 고를 수만 있고, nmap 옵션을 직접 정할 수 없습니다.
 * 모두 관리자 권한이 필요 없는 TCP 연결 스캔(-sT)이며, 속도를 제한합니다.
 */
export const PROFILES: Record<ScanProfileId, { label: string; desc: string; args: string[] }> = {
  quick: {
    label: "주요 포트 확인",
    desc: "자주 쓰는 TCP 포트 100개가 열려 있는지만 확인합니다.",
    args: ["-sT", "-Pn", "--top-ports", "100"],
  },
  service: {
    label: "서비스 버전 확인",
    desc: "주요 포트 100개와, 열린 포트의 서비스 종류·버전을 가볍게 확인합니다.",
    args: ["-sT", "-Pn", "--top-ports", "100", "-sV", "--version-light"],
  },
};

/** 모든 스캔에 공통으로 붙는 안전 옵션: 보통 속도, 초당 50패킷 이하, 대상당 5분 제한, XML 출력 */
const SAFETY = ["-T3", "--max-rate", "50", "--host-timeout", "5m", "-oX", "-"];

export const isProfile = (p: unknown): p is ScanProfileId => p === "quick" || p === "service";

/** 실행할 nmap 인자. 대상은 허용 목록에서 검증된 값만 들어옵니다. */
export function buildNmapArgs(profile: ScanProfileId, targets: string[]): string[] {
  return [...PROFILES[profile].args, ...SAFETY, ...targets];
}
