"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveOffice } from "@/lib/live/useLiveOffice";
import { TEAM_NAME } from "@/lib/office/roster";
import type { AgentId, OfficePhase } from "@/lib/office/types";
import { downloadReport } from "@/lib/reports/download";
import type { ReportMeta, SavedReport } from "@/lib/reports/types";
import { useSimulatedOffice } from "@/lib/sim/useSimulatedOffice";
import { CommandBar } from "./CommandBar";
import { IconAlert, IconArchive } from "./icons";
import { ModeSwitch, type OfficeMode } from "./ModeSwitch";
import { OfficeFloor } from "./office/OfficeFloor";
import { ApprovalPanel } from "./panels/ApprovalPanel";
import { ReportHistory } from "./panels/ReportHistory";
import { type Billing, WorkLog } from "./panels/WorkLog";

/** /api/status 응답 (서버의 BackendStatus와 같은 모양) */
interface BackendStatus {
  live: boolean;
  kind: "subscription" | "api";
  plan?: string;
  hint?: string;
}

const MODE_KEY = "ai-office:mode";

const PLACEHOLDER: Record<OfficePhase, string> = {
  idle: "무엇을 맡길까요? 한 줄로 지시하세요 (예: 최근 랜섬웨어 대응 점검해줘)",
  running: "팀원들이 업무를 진행 중입니다…",
  awaiting_scan: "먼저 오른쪽의 스캔 실행 승인 요청을 결정해 주세요",
  awaiting_approval: "먼저 오른쪽의 보고서 결재를 처리해 주세요 (승인 또는 반려)",
};

/** 첨부할 수 있는 nmap XML 최대 크기 (서버와 같은 값) */
const MAX_SCAN_XML = 5 * 1024 * 1024;

export function Office() {
  const live = useLiveOffice();
  const sim = useSimulatedOffice();
  const [status, setStatus] = useState<BackendStatus>({ live: false, kind: "subscription" });
  const [mode, setModeState] = useState<OfficeMode>("sim");
  const [selected, setSelected] = useState<AgentId | null>(null);
  const [logFilter, setLogFilter] = useState<AgentId | null>(null);
  const [saved, setSaved] = useState<SavedReport | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scanFile, setScanFile] = useState<{ name: string; size: number; xml: string } | null>(null);
  const [scanFileError, setScanFileError] = useState<string | null>(null);

  // 마지막으로 고른 모드를 기억합니다. 처음이면 구독 로그인이 확인될 때 실제 AI로 시작합니다.
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: BackendStatus) => {
        setStatus(s);
        const remembered = localStorage.getItem(MODE_KEY);
        setModeState(s.live && remembered !== "sim" ? "live" : "sim");
      })
      .catch(() => setStatus({ live: false, kind: "subscription", hint: "서버 상태를 확인하지 못했습니다" }));
  }, []);

  const setMode = (m: OfficeMode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  };

  const office = mode === "live" ? live : sim;
  const { state } = office;
  const busy = live.state.phase !== "idle" || sim.state.phase !== "idle";
  const billing: Billing = mode === "sim" ? "sim" : status.kind;

  // 결재 대기 중이면 브라우저 탭 제목에 표시 (다른 창을 보고 있어도 알 수 있게)
  useEffect(() => {
    document.title =
      state.phase === "awaiting_approval"
        ? `(보고서 결재 대기) ${TEAM_NAME}`
        : state.phase === "awaiting_scan"
          ? `(스캔 승인 대기) ${TEAM_NAME}`
          : TEAM_NAME;
  }, [state.phase]);

  const start = (command: string) => {
    setSaved(null);
    if (mode === "live") live.start(command, scanFile ? { scanXml: scanFile.xml } : undefined);
    else sim.start(command);
    setScanFile(null);
  };

  /** nmap 결과 파일을 읽어 둡니다. 실제 분석과 별칭 처리는 서버에서 합니다. */
  const pickScanFile = async (file: File) => {
    setScanFileError(null);
    if (file.size > MAX_SCAN_XML) return setScanFileError("5MB 이하의 파일만 첨부할 수 있습니다");
    const xml = await file.text();
    if (!xml.includes("<nmaprun")) return setScanFileError("nmap XML 결과 파일(-oX로 저장)이 아닙니다");
    setScanFile({ name: file.name, size: file.size, xml });
  };

  /** 승인하면 보고서를 저장하고, 성공 상태와 업무 로그로 알립니다. */
  const approve = async () => {
    const { approval, command } = office.state;
    if (!approval) return;
    const { log } = office;
    office.approve();
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: approval.title,
          summary: approval.summary,
          command: command ?? "",
          // 부록(별칭 대응표)은 이 PC의 저장본에만 붙입니다.
          content: [approval.content, approval.appendix].filter(Boolean).join("\n\n"),
          round: approval.round,
          source: mode === "live" ? "live" : "sim",
          scan: approval.scan,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `서버 오류 (${res.status})`);
      const meta = (await res.json()) as ReportMeta;
      setSaved({ ...meta, content: [approval.content, approval.appendix].filter(Boolean).join("\n\n") });
      setRefreshKey((k) => k + 1);
      log("승인한 보고서를 기록에 저장했습니다");
    } catch (err) {
      log(`보고서 저장 실패 — ${err instanceof Error ? err.message : "알 수 없는 오류"}. 결재를 다시 요청하려면 같은 지시를 다시 실행해 주세요.`);
    }
  };

  const showLog = useCallback((id: AgentId) => {
    setLogFilter(id);
    setSelected(null);
  }, []);

  return (
    <div className="mx-auto flex h-dvh min-h-[720px] max-w-[1520px] flex-col gap-3 px-6 py-4">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1.5">
        <h1 className="shrink-0 text-[22px] font-extrabold tracking-tight">{TEAM_NAME}</h1>
        <CommandBar
          live={mode === "live"}
          disabled={state.phase !== "idle"}
          placeholder={PLACEHOLDER[state.phase]}
          onSubmit={start}
          onStop={state.phase === "running" || state.phase === "awaiting_scan" ? office.stop : undefined}
          attachment={
            mode === "live"
              ? {
                  file: scanFile,
                  error: scanFileError,
                  onPick: (f) => void pickScanFile(f),
                  onClear: () => setScanFile(null),
                }
              : undefined
          }
          modeSwitch={
            <ModeSwitch mode={mode} liveAvailable={status.live} hint={status.hint} disabled={busy} onChange={setMode} />
          }
        />
        <button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-sm font-bold hover:border-ink-2">
          <IconArchive /> 보고서 기록 <span className="tabular text-accent-text">{reportCount}</span>
        </button>
        <p className={`col-start-2 flex items-center gap-1.5 px-1 text-xs ${scanFileError ? "text-[#8f2f25]" : "text-muted"}`}>
          <IconAlert className="size-3.5" />
          {scanFileError
            ? `첨부 실패: ${scanFileError}`
            : scanFile
              ? "첨부한 nmap 결과를 어떻게 분석할지 적고 실행하세요. 실제 IP는 별칭으로 바꿔 AI에게 보냅니다."
              : mode === "live"
            ? `지시 내용은 Claude로 전송되고 ${status.kind === "subscription" ? "구독 사용량에서 차감됩니다" : "API 요금이 청구됩니다"}. 실제 고객정보·비밀번호·내부 IP는 입력하지 마세요.`
              : "시뮬레이션은 AI를 부르지 않고 예시 흐름만 재생합니다. 결과물은 실제 조사 결과가 아닙니다."}
        </p>
      </header>


      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.45fr)_minmax(380px,1fr)] gap-3">
        <OfficeFloor
          statuses={state.statuses}
          phase={state.phase}
          handoffs={state.handoffs}
          selected={selected}
          currentTasks={state.tasks}
          onSelect={setSelected}
          onShowLog={showLog}
        />
        <div className="flex min-h-0 flex-col gap-3">
          <ApprovalPanel
            approval={state.approval}
            scanRequest={state.scanRequest}
            onDecideScan={(approve) => void office.decideScan(approve)}
            phase={state.phase}
            saved={saved}
            onApprove={approve}
            onReject={office.reject}
            onDownloadSaved={() => saved && downloadReport(saved)}
            onOpenHistory={() => setHistoryOpen(true)}
          />
          <WorkLog
            logs={state.logs}
            usage={state.usage}
            quota={state.quota}
            billing={billing}
            filter={logFilter}
            onClearFilter={() => setLogFilter(null)}
            onClear={office.clearLogs}
          />
        </div>
      </main>

      <ReportHistory open={historyOpen} onOpenChange={setHistoryOpen} refreshKey={refreshKey} onCountChange={setReportCount} />
    </div>
  );
}
