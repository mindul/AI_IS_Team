"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_BY_ID } from "@/lib/office/roster";
import type { AgentId, Approval, OfficePhase } from "@/lib/office/types";
import { reportFacts } from "@/lib/reports/facts";
import type { SavedReport } from "@/lib/reports/types";
import { IconAlert, IconArchive, IconCheck, IconDoc, IconDownload } from "../icons";
import { btn } from "../ui";
import type { ScanRequest } from "@/lib/scan/types";
import { scanOutcomeLabel } from "@/lib/scan/outcome";
import { ApprovalSteps } from "./ApprovalSteps";
import { ReportViewer } from "./ReportViewer";
import { ScanApprovalCard } from "./ScanApprovalCard";

function Contributors({ ids }: { ids: AgentId[] }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex -space-x-1">
        {ids.map((id) => (
          <span
            key={id}
            title={AGENT_BY_ID[id].name}
            style={{ backgroundColor: AGENT_BY_ID[id].color }}
            className="grid size-5 place-items-center rounded-full text-[11px] font-bold text-white ring-2 ring-approval"
          >
            {AGENT_BY_ID[id].initial}
          </span>
        ))}
      </span>
      <span>{ids.map((id) => AGENT_BY_ID[id].shortName).join(" · ")}</span>
    </span>
  );
}

/** 결재 판단 근거 한 줄: 참여 직원 · 출처 수 · 확인 필요 표시 수 */
function Evidence({ approval }: { approval: Approval }) {
  const facts = reportFacts(approval.content);
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
      {approval.contributors && approval.contributors.length > 0 && (
        <div>
          <dt className="sr-only">참여 직원</dt>
          <dd>
            <Contributors ids={approval.contributors} />
          </dd>
        </div>
      )}
      {approval.scan && (
        <div>
          <dt className="sr-only">스캔 단계</dt>
          <dd className="font-semibold text-scan">{scanOutcomeLabel(approval.scan)}</dd>
        </div>
      )}
      <div className="tabular">
        <dt className="inline text-muted">출처 </dt>
        <dd className="inline font-semibold">{facts.sources}건</dd>
      </div>
      <div className="tabular">
        <dt className="inline text-muted">확인 필요 </dt>
        <dd className={`inline font-semibold ${facts.checks > 0 ? "text-accent-text" : ""}`}>{facts.checks}곳</dd>
      </div>
    </dl>
  );
}

export function ApprovalPanel({
  approval,
  scanRequest,
  onDecideScan,
  phase,
  saved,
  approving,
  onApprove,
  onReject,
  onDownloadSaved,
  onOpenHistory,
}: {
  approval: Approval | null;
  /** 팀장 승인을 기다리는 시스템 점검 요청 */
  scanRequest: ScanRequest | null;
  onDecideScan: (approve: boolean) => Promise<boolean>;
  phase: OfficePhase;
  /** 방금 승인·저장된 보고서 (다음 지시 전까지 성공 상태로 보여줌) */
  saved: SavedReport | null;
  /** 승인한 보고서를 저장하는 중 (버튼을 잠금) */
  approving: boolean;
  onApprove: () => void;
  onReject: (comment: string) => void;
  onDownloadSaved: () => void;
  onOpenHistory: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [reading, setReading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);

  // 결재가 도착하면 키보드·화면 낭독기 사용자도 바로 결재로 갈 수 있게 포커스를 옮깁니다.
  useEffect(() => {
    if (approval) headingRef.current?.focus({ preventScroll: true });
  }, [approval?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rejecting) reasonRef.current?.focus();
  }, [rejecting]);

  const closeReject = () => {
    setRejecting(false);
    setComment("");
  };
  const startReject = () => {
    setReading(false);
    setRejecting(true);
  };
  const approve = () => {
    setReading(false);
    onApprove();
  };

  const announcement = scanRequest
    ? `스캔 실행 승인 요청이 도착했습니다: ${scanRequest.targets.map((t) => t.name).join(", ")}`
    : approval
      ? `보고서 결재 요청이 도착했습니다: ${approval.title}`
      : "";
  /** 보고서 본문 + 이 PC에서만 붙이는 부록 */
  const fullContent = approval ? [approval.content, approval.appendix].filter(Boolean).join("\n\n") : "";

  return (
    <section aria-labelledby="approval-heading" className="shrink-0">
      <p className="sr-only" role="status" aria-live="assertive">
        {announcement}
      </p>

      {scanRequest ? (
        <ScanApprovalCard scan={scanRequest} onDecide={onDecideScan} />
      ) : approval ? (
        <div key={approval.id} className="anim-arrive rounded-xl border border-approval-line bg-approval p-4">
          {approval.scan && <ApprovalSteps current="report" scan={approval.scan} />}
          <div className="flex items-start justify-between gap-3">
            <h2 id="approval-heading" ref={headingRef} tabIndex={-1} className="text-[17px] leading-snug font-bold text-balance focus-visible:outline-none">
              {approval.title}
            </h2>
            <span className="mt-0.5 shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-white">
              {approval.round > 1 ? `보고서 결재 · 수정 ${approval.round - 1}차` : "보고서 결재"}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ink-2">{approval.summary}</p>

          <div className="mt-3">
            <Evidence approval={approval} />
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[13px] text-ink-2">
            <IconAlert className="mt-0.5 size-3.5 text-accent-text" />
            AI가 쓴 초안입니다. 수치·법령·출처를 확인한 뒤 보고서를 승인하세요.
          </p>

          {rejecting ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!comment.trim()) return;
                onReject(comment.trim());
                closeReject();
              }}
            >
              <input
                ref={reasonRef}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && closeReject()}
                placeholder="무엇을 고칠지 적어 주세요 (예: KISA 가이드 출처 보강)"
                maxLength={1000}
                aria-label="반려 사유"
                className="min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 py-2 text-sm placeholder:text-faint focus:border-ink-2 focus:outline-none"
              />
              <button type="button" onClick={closeReject} className={btn.ghost}>
                취소
              </button>
              <button type="submit" disabled={!comment.trim()} className={btn.secondary}>
                반려하기
              </button>
            </form>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => setReading(true)} className={btn.secondary}>
                <IconDoc /> 보고서 읽기
              </button>
              <span className="flex-1" />
              <button type="button" onClick={startReject} disabled={approving} className={btn.secondary}>
                반려
              </button>
              <button type="button" onClick={approve} disabled={approving} className={btn.primary}>
                <IconCheck /> {approving ? "저장 중…" : "보고서 승인"}
              </button>
            </div>
          )}

          <ReportViewer
            open={reading}
            title={approval.title}
            content={fullContent}
            meta={approval.round > 1 ? `보고서 결재 대기 · 수정 ${approval.round - 1}차` : "보고서 결재 대기"}
            notice={<Evidence approval={approval} />}
            onClose={() => setReading(false)}
            actions={
              <>
                <button type="button" onClick={startReject} disabled={approving} className={btn.secondary}>
                  반려
                </button>
                <button type="button" onClick={approve} disabled={approving} className={btn.primary}>
                  <IconCheck /> {approving ? "저장 중…" : "보고서 승인"}
                </button>
              </>
            }
          />
        </div>
      ) : saved && phase === "idle" ? (
        <div className="rounded-xl border border-success-line bg-success-surface p-4">
          <h2 id="approval-heading" className="flex items-center gap-1.5 text-sm font-bold text-success">
            <IconCheck /> 보고서를 승인하고 기록에 저장했습니다
          </h2>
          <p className="mt-1 truncate text-[15px] font-semibold">{saved.title}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onDownloadSaved} className={btn.secondary}>
              <IconDownload /> HTML 내려받기
            </button>
            <button type="button" onClick={onOpenHistory} className={btn.ghost}>
              <IconArchive /> 보고서 기록
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3">
          <h2 id="approval-heading" className="text-sm font-bold">
            결재함
          </h2>
          <p className="text-[13px] text-muted">
            {phase === "running" ? "팀원들이 작업 중입니다. 승인이 필요하면 여기로 올라와요." : "대기 중인 승인·결재가 없습니다"}
          </p>
        </div>
      )}
    </section>
  );
}
