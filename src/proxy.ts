import { type NextRequest, NextResponse } from "next/server";
import { checkRequest } from "./lib/security/origin";

/** 모든 API 요청에 접속 주소·요청 출처 검사를 적용합니다 (src/lib/security/origin.ts 참고). */
export function proxy(request: NextRequest) {
  const reason = checkRequest({
    method: request.method,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
  });
  if (reason) return NextResponse.json({ error: reason }, { status: 403 });
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
