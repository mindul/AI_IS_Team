"use client";

import { useRef } from "react";

export type OfficeMode = "live" | "sim";

const OPTIONS: { value: OfficeMode; label: string }[] = [
  { value: "live", label: "실제 AI" },
  { value: "sim", label: "시뮬레이션" },
];

/** 실제 AI / 시뮬레이션 전환. 표준 라디오 그룹처럼 방향키로 바꿀 수 있습니다. */
export function ModeSwitch({
  mode,
  liveAvailable,
  hint,
  disabled,
  onChange,
}: {
  mode: OfficeMode;
  liveAvailable: boolean;
  hint?: string;
  disabled: boolean;
  onChange: (m: OfficeMode) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = (m: OfficeMode) => !disabled && (m === "sim" || liveAvailable);

  const move = (dir: 1 | -1) => {
    const i = OPTIONS.findIndex((o) => o.value === mode);
    const next = OPTIONS[(i + dir + OPTIONS.length) % OPTIONS.length];
    if (!enabled(next.value)) return;
    onChange(next.value);
    refs.current[OPTIONS.indexOf(next)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="실행 모드"
      title={liveAvailable ? undefined : hint}
      onKeyDown={(e) => {
        const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        move(dir);
      }}
      className="inline-flex shrink-0 gap-0.5 rounded-md bg-sunken p-0.5"
    >
      {OPTIONS.map((o, i) => {
        const checked = mode === o.value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={!enabled(o.value)}
            onClick={() => onChange(o.value)}
            className={`rounded px-2.5 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
              checked
                ? o.value === "live"
                  ? "bg-accent text-white"
                  : "bg-ink text-white"
                : "text-muted enabled:hover:text-ink disabled:opacity-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
