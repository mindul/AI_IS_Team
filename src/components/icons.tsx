/** 앱 전체에서 쓰는 선 아이콘 (16px 그리드, 1.6 두께로 통일) */
type IconProps = { className?: string };

function Svg({ className = "size-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.2 14.3 13H1.7L8 2.2Z" />
    <path d="M8 6.5v3" />
    <path d="M8 11.4v.01" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 8.4 3.2 3.1L13 4.6" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.5v8" />
    <path d="m4.8 7.6 3.2 3.2 3.2-3.2" />
    <path d="M2.8 13.3h10.4" />
  </Svg>
);
export const IconDoc = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 1.8h5.4L12.5 5v9.2H4z" />
    <path d="M9.2 1.8V5h3.3" />
    <path d="M6 8.3h4.5M6 10.8h4.5" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.7.7" />
    <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.7-.7" />
  </Svg>
);
export const IconArchive = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.8" y="2.6" width="12.4" height="3.2" rx="0.8" />
    <path d="M3 5.8v7.6h10V5.8" />
    <path d="M6.4 8.6h3.2" />
  </Svg>
);
export const IconStop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="8" height="8" rx="1.2" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.4 8h10.2" />
    <path d="m8.8 4.2 3.8 3.8-3.8 3.8" />
  </Svg>
);
export const IconPaperclip = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 7.4 8 12.4a3.2 3.2 0 0 1-4.5-4.5l5.3-5.3a2.1 2.1 0 0 1 3 3L6.6 10.8a1 1 0 0 1-1.5-1.5L9.7 4.7" />
  </Svg>
);
