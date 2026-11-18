import type { Metadata } from "next";
import localFont from "next/font/local";
import { TEAM_NAME } from "@/lib/office/roster";
import "./globals.css";

/** 본문 글꼴: Pretendard (OFL). 인터넷 없이도 보이도록 앱에 포함해 내보냅니다. */
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: TEAM_NAME,
  description: "팀장이 지시하면 AI 직원들이 실제로 일하는 가상 사무실",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
