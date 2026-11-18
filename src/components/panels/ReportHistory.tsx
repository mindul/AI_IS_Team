"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { downloadReport } from "@/lib/reports/download";
import { scanOutcomeLabel } from "@/lib/scan/outcome";
import type { ReportMeta, SavedReport } from "@/lib/reports/types";
import { IconClose, IconDownload } from "../icons";
import { btn } from "../ui";
import { ReportViewer } from "./ReportViewer";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * 보고서 기록: 목록 → 보고서 보기(내려받기·삭제).
 * 보고서를 열면 목록 창은 닫고, 보고서를 닫으면 목록으로 돌아옵니다 (창이 겹치지 않게).
 */
export function ReportHistory({
  open,
  onOpenChange,
  refreshKey,
  onCountChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshKey: number;
  onCountChange: (n: number) => void;
}) {
  const listRef = useRef<HTMLDialogElement>(null);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<SavedReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const list = (await res.json()) as ReportMeta[];
      setReports(list);
      onCountChange(list.length);
      setError(null);
    } catch {
      setError("보고서 목록을 불러오지 못했습니다. 서버가 실행 중인지 확인해 주세요.");
    }
  }, [onCountChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버 목록과 동기화
    void load();
  }, [load, refreshKey]);

  // 목록 창 열기·닫기 (보고서를 보는 중에는 목록을 닫아 둠)
  useEffect(() => {
    const d = listRef.current;
    if (!d) return;
    const show = open && !current;
    if (show && !d.open) d.showModal();
    if (!show && d.open) d.close();
  }, [open, current]);

  const openReport = async (id: string) => {
    const res = await fetch(`/api/reports/${id}`, { cache: "no-store" });
    if (!res.ok) return setError("보고서를 열지 못했습니다. 목록을 새로고침해 주세요.");
    setConfirmDelete(false);
    setCurrent(await res.json());
  };

  const remove = async () => {
    if (!current) return;
    const res = await fetch(`/api/reports/${current.id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) return setError("삭제하지 못했습니다.");
    setCurrent(null);
    await load();
  };

  return (
    <>
      <dialog
        ref={listRef}
        onClose={() => !current && onOpenChange(false)}
        onClick={(e) => e.target === listRef.current && onOpenChange(false)}
        aria-label="보고서 기록"
        className="m-auto max-h-[80vh] w-[min(720px,92vw)] overflow-hidden rounded-xl border border-line bg-panel p-0 text-ink shadow-[0_24px_64px_-24px_rgb(29_25_21/0.45)] backdrop:bg-[rgb(29_25_21/0.42)]"
      >
        <div className="flex max-h-[80vh] flex-col">
          <header className="flex items-start gap-4 border-b border-line px-6 py-4">
            <div className="flex-1">
              <h2 className="text-[17px] font-bold">보고서 기록</h2>
              <p className="mt-0.5 text-[13px] text-muted">팀장이 승인한 보고서입니다. 이 PC의 data/reports 폴더에 보관됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="닫기"
              className="rounded-md p-2 text-muted hover:bg-sunken hover:text-ink"
            >
              <IconClose />
            </button>
          </header>
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {error && <li className="px-6 py-3 text-sm text-danger">{error}</li>}
            {reports.length === 0 && !error && (
              <li className="px-6 py-12 text-center text-sm text-muted">
                아직 승인한 보고서가 없습니다.
                <br />
                결재함에서 승인하면 이곳에 저장되고 HTML로 내려받을 수 있습니다.
              </li>
            )}
            {reports.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => openReport(r.id)} className="block w-full px-6 py-3.5 text-left hover:bg-sunken/60">
                  <div className="flex items-baseline gap-2">
                    {r.source === "sim" && (
                      <span className="shrink-0 rounded bg-sunken px-1.5 py-px text-[11px] font-bold text-muted">시뮬레이션</span>
                    )}
                    <span className="truncate text-[15px] font-semibold">{r.title}</span>
                    {r.scan && (
                      <span className="shrink-0 rounded bg-scan-soft px-1.5 py-px text-[11px] font-bold text-scan">
                        {r.scan.decision === "approved" ? "스캔 승인" : r.scan.decision === "rejected" ? "스캔 거절" : "스캔 결과 첨부"}
                      </span>
                    )}
                    {r.round > 1 && <span className="shrink-0 text-xs text-muted">수정 {r.round - 1}차</span>}
                    <span className="tabular ml-auto shrink-0 text-xs text-muted">{fmt(r.approvedAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-muted">지시: {r.command}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>

      {current && (
        <ReportViewer
          open
          title={current.title}
          content={current.content}
          meta={`${fmt(current.approvedAt)} 보고서 승인${current.round > 1 ? ` · 수정 ${current.round - 1}차` : ""}${
            current.scan ? ` · ${scanOutcomeLabel(current.scan)}` : ""
          }${current.source === "sim" ? " · 시뮬레이션 예시" : ""}`}
          onClose={() => setCurrent(null)}
          actions={
            confirmDelete ? (
              <>
                <span className="text-[13px] font-semibold text-danger">삭제하면 되돌릴 수 없습니다</span>
                <button type="button" onClick={() => setConfirmDelete(false)} className={btn.ghost}>
                  취소
                </button>
                <button type="button" onClick={remove} className={btn.danger}>
                  삭제
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setConfirmDelete(true)} className={btn.ghost}>
                  삭제
                </button>
                <button type="button" onClick={() => downloadReport(current)} className={btn.primary}>
                  <IconDownload /> HTML 내려받기
                </button>
              </>
            )
          }
        />
      )}
    </>
  );
}
