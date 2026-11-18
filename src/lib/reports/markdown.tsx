"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** 보고서 Markdown 렌더러. 원본 HTML 태그는 렌더링하지 않고(react-markdown 기본) 링크는 새 창으로 엽니다. */
export function ReportMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer noopener" /> }}
    >
      {content}
    </ReactMarkdown>
  );
}

/** 다운로드용 HTML 본문을 만들기 위해 화면 밖에서 한 번 렌더링합니다. */
export function renderMarkdownHtml(content: string): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(<ReportMarkdown content={content} />));
  const html = host.innerHTML;
  root.unmount();
  return html;
}
