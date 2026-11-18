import type { Metadata } from "next";
import { TEAM_NAME } from "@/lib/office/roster";
import "./globals.css";

export const metadata: Metadata = {
  title: TEAM_NAME,
  description: "팀장이 지시하면 AI 직원들이 실제로 일하는 가상 사무실",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
