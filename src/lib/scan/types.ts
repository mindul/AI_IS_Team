/** 팀장이 허용 목록(config/scan-targets.json)에 등록한 점검 대상 */
export interface ScanTarget {
  /** AI에게는 이 이름(별칭)만 전달됩니다. 예: "테스트 웹서버" */
  name: string;
  /** 실제 대상: IPv4, IPv4 CIDR(/24 이상), 또는 호스트 이름. 이 PC 밖으로 보내지 않습니다. */
  target: string;
  note?: string;
}

export type ScanProfileId = "quick" | "service";

/** 팀장 결재가 필요한 스캔 요청 (화면에만 실제 대상이 표시됨) */
export interface ScanRequest {
  id: string;
  targets: ScanTarget[];
  profile: ScanProfileId;
  profileLabel: string;
  profileDesc: string;
  reason: string;
}

export interface ScanPort {
  protocol: string;
  port: number;
  state: string;
  service?: string;
  product?: string;
  version?: string;
}

export interface ScanHost {
  address: string;
  hostname?: string;
  status: string;
  ports: ScanPort[];
  /** <extraports>로 묶여 생략된 포트 수 (상태별) */
  omitted: Record<string, number>;
}

export interface ScanResult {
  hosts: ScanHost[];
  startedAt?: string;
}

/** 보고서에 함께 남기는 스캔 단계의 결과 (보고서 결재와 구분되는 별도 승인) */
export interface ScanOutcome {
  /** approved: 팀장이 스캔 실행을 승인 / rejected: 승인하지 않음 / uploaded: 팀장이 첨부한 결과를 분석 */
  decision: "approved" | "rejected" | "uploaded";
  /** 대상 별칭 (실제 주소는 보고서 부록에만) */
  targets: string[];
  profileLabel?: string;
}
