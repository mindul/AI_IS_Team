import { connection } from "next/server";
import { backendStatus } from "@/lib/ai/selectBackend";

/** 실제 AI 모드를 쓸 수 있는지 알려줍니다. 키·이메일 같은 개인정보는 내보내지 않습니다. */
export async function GET() {
  await connection(); // 빌드 시점이 아니라 요청 시점에 확인
  return Response.json(await backendStatus());
}
