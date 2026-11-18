"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { IconClose, IconPaperclip, IconSend, IconStop } from "./icons";
import { btn } from "./ui";

/** 팀장 지시 입력줄. 왼쪽에 실행 모드, 오른쪽에 실행(또는 중지) 버튼. "/" 키로 바로 입력할 수 있습니다. */
export function CommandBar({
  attachment,
  modeSwitch,
  live,
  disabled,
  placeholder,
  onSubmit,
  onStop,
}: {
  modeSwitch: ReactNode;
  /** 실제 AI 모드인지 (버튼 문구에 구독 차감을 표시) */
  live: boolean;
  disabled: boolean;
  placeholder: string;
  onSubmit: (text: string) => void;
  /** 넘기면 실행 대신 중지 버튼을 보여줍니다 (업무 진행 중) */
  onStop?: () => void;
  /** nmap 결과 첨부 (실제 AI 모드에서만) */
  attachment?: {
    file: { name: string; size: number } | null;
    error: string | null;
    onPick: (file: File) => void;
    onClear: () => void;
  };
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trimmed = text.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.closest("input, textarea, [contenteditable], dialog")) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      className="flex flex-1 items-center gap-3 rounded-xl border border-line-strong bg-white py-1.5 pr-1.5 pl-1.5 shadow-[0_1px_2px_rgb(29_25_21/0.05)] focus-within:border-ink-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed || disabled) return;
        onSubmit(trimmed);
        setText("");
      }}
    >
      {modeSwitch}
      <input
        ref={inputRef}
        id="command"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label="팀장 지시"
        aria-keyshortcuts="/"
        autoComplete="off"
        autoFocus
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint disabled:cursor-not-allowed"
      />
      {attachment && !onStop && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) attachment.onPick(f);
              e.target.value = "";
            }}
          />
          {attachment.file ? (
            <span className="inline-flex max-w-[220px] shrink-0 items-center gap-1 rounded-md bg-[#e3eaf4] py-1 pr-1 pl-2 text-xs font-semibold text-[#2d4f7c]">
              <IconPaperclip className="size-3.5" />
              <span className="truncate">{attachment.file.name}</span>
              <span className="tabular shrink-0 font-normal">{Math.max(1, Math.round(attachment.file.size / 1024))}KB</span>
              <button type="button" onClick={attachment.onClear} aria-label="첨부 취소" className="rounded p-0.5 hover:bg-white/70">
                <IconClose className="size-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              title="nmap XML 결과 파일(-oX)을 첨부하면 AI가 분석합니다. 실제 IP는 별칭으로 바꿔 보냅니다."
              className={btn.ghost}
            >
              <IconPaperclip /> nmap 결과 첨부
            </button>
          )}
        </>
      )}
      {onStop ? (
        <button
          type="button"
          onClick={onStop}
          title="진행 중인 업무를 멈춥니다. 작성 중이던 초안은 저장되지 않습니다."
          className={`${btn.secondary} border-[#d7a39b] text-[#8f2f25] hover:border-[#8f2f25]`}
        >
          <IconStop /> 중지
        </button>
      ) : (
        <button type="submit" disabled={!trimmed || disabled} className={live ? btn.primary : `${btn.primary} bg-ink hover:bg-ink-2`}>
          {live ? "실행 · Pro 차감" : "시뮬레이션 실행"}
          <IconSend />
        </button>
      )}
    </form>
  );
}
