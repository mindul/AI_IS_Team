"use client";

import { useEffect, useRef, useState } from "react";
import type { ScanRequest } from "@/lib/scan/types";
import { IconAlert } from "../icons";
import { btn } from "../ui";
import { ApprovalSteps } from "./ApprovalSteps";

/**
 * 시스템 점검(스캔) 승인 요청. 실제 대상(IP)은 이 화면에만 표시되고 AI에게는 가지 않습니다.
 * 팀장이 승인해야 앱이 정해진 nmap 옵션으로 스캔합니다.
 */
export function ScanApprovalCard({
  scan,
  onDecide,
}: {
  scan: ScanRequest;
  /** 서버에 전달했으면 true. 실패하면 버튼을 다시 보여줍니다. */
  onDecide: (approve: boolean) => Promise<boolean>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [sent, setSent] = useState<boolean | null>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [scan.id]);

  const decide = async (approve: boolean) => {
    setSent(approve);
    if (!(await onDecide(approve))) setSent(null);
  };

  return (
    <div className="anim-arrive rounded-xl border border-scan-line bg-scan-surface p-4">
      <ApprovalSteps current="scan" />
      <div className="flex items-start justify-between gap-3">
        <h2 id="approval-heading" ref={headingRef} tabIndex={-1} className="text-[17px] leading-snug font-bold focus-visible:outline-none">
          포트 스캔을 실행할까요?
        </h2>
        <span className="mt-0.5 shrink-0 rounded bg-scan px-1.5 py-0.5 text-xs font-bold text-white">스캔 실행 승인</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{scan.reason}</p>

      <table className="mt-3 w-full text-[13px]">
        <caption className="sr-only">점검 대상</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-1 font-semibold">대상</th>
            <th className="pb-1 font-semibold">실제 주소 (이 PC에만 표시)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {scan.targets.map((t) => (
            <tr key={t.name}>
              <td className="py-1.5 pr-3 font-semibold">{t.name}</td>
              <td className="tabular py-1.5 font-mono text-[12px] text-ink-2">{t.target}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-[13px] text-ink-2">
        <b className="font-semibold">{scan.profileLabel}</b> — {scan.profileDesc} 관리자 권한 없이 초당 50패킷 이하로 실행합니다.
      </p>
      <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-2">
        <IconAlert className="mt-0.5 size-3.5 text-scan" />
        이 승인은 스캔 실행만 허락합니다. 결과 보고서는 스캔 뒤에 따로 결재를 요청합니다. 운영 시스템이라면 점검 시간과 보안관제(SOC) 공유 여부를 확인하세요.
      </p>

      <div className="mt-3 flex items-center justify-end gap-2">
        {sent === null ? (
          <>
            <button type="button" onClick={() => void decide(false)} className={btn.secondary}>
              스캔하지 않음
            </button>
            <button type="button" onClick={() => void decide(true)} className={btn.scan}>
              스캔 실행 승인
            </button>
          </>
        ) : (
          <span className="text-[13px] font-semibold text-muted">{sent ? "스캔 실행을 승인했습니다. 스캔을 시작합니다…" : "스캔하지 않도록 전달했습니다…"}</span>
        )}
      </div>
    </div>
  );
}
