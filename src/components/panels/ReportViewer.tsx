"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { ReportMarkdown } from "@/lib/reports/markdown";
import { IconClose } from "../icons";

/**
 * 보고서 전체를 읽는 창. 머리글에 그 자리에서 할 행동(승인·반려, 내려받기·삭제)을 함께 둡니다.
 * 읽고 나서 창을 닫고 버튼을 다시 찾지 않아도 되게 하기 위함입니다.
 */
export function ReportViewer({
  open,
  title,
  content,
  meta,
  notice,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  content: string;
  /** 제목 아래 한 줄 정보 (승인 일시, 차수 등) */
  meta?: ReactNode;
  /** 본문 위에 고정해 둘 안내 (확인 필요 사항 등) */
  notice?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-auto h-[88vh] w-[min(920px,94vw)] overflow-hidden rounded-xl border border-line bg-panel p-0 text-ink shadow-[0_24px_64px_-24px_rgb(29_25_21/0.45)] backdrop:bg-[rgb(29_25_21/0.42)]"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] leading-snug font-bold text-balance">{title}</h2>
            {meta && <div className="mt-1 text-[13px] text-muted">{meta}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button type="button" onClick={onClose} aria-label="닫기" className="rounded-md p-2 text-muted hover:bg-sunken hover:text-ink">
              <IconClose />
            </button>
          </div>
        </header>
        {notice && <div className="border-b border-line bg-approval px-6 py-2.5 text-[13px] text-ink-2">{notice}</div>}
        <article className="report min-h-0 flex-1 overflow-y-auto px-10 py-7">
          <div className="mx-auto max-w-[72ch]">
            <ReportMarkdown content={content} />
          </div>
        </article>
      </div>
    </dialog>
  );
}
