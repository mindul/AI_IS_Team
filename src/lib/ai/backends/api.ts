import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { Backend, RunHooks, RunRequest, RunResult } from "../backend";
import { AgentRefusalError, UserFacingError } from "../errors";
import { costOf } from "../usage";

/** 거절 시 서버가 다른 모델로 자동 재시도하도록 하는 beta 기능 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/**
 * (선택) Anthropic API 키로 호출합니다. 사용량만큼 API 요금이 청구됩니다.
 * AI_BACKEND=api 이고 ANTHROPIC_API_KEY가 있을 때만 쓰입니다.
 */
export const apiBackend: Backend = {
  kind: "api",

  async run(req: RunRequest, hooks: RunHooks, signal: AbortSignal): Promise<RunResult> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: req.user }];
    const tools: Anthropic.Beta.BetaToolUnion[] | undefined = req.searchLimit
      ? [{ type: "web_search_20260209", name: "web_search", max_uses: req.searchLimit }]
      : undefined;

    let text = "";
    try {
      for (let turn = 0; turn < 4; turn++) {
        const stream = getClient().beta.messages.stream(
          {
            model: req.model,
            max_tokens: req.maxTokens,
            system: req.system,
            messages,
            ...(tools && { tools }),
            output_config: {
              effort: req.effort,
              ...(req.jsonSchema && { format: { type: "json_schema", schema: req.jsonSchema } }),
            },
            betas: [FALLBACK_BETA],
            fallbacks: "default",
          },
          { signal },
        );
        stream.on("contentBlock", (block) => {
          if (block.type === "server_tool_use" && block.name === "web_search") {
            hooks.onSearch(String((block.input as { query?: unknown }).query ?? ""));
          }
        });

        const msg = await stream.finalMessage();
        hooks.onUsage(costOf(msg.model, msg.usage));

        if (msg.stop_reason === "refusal") throw new AgentRefusalError(req.agentId, msg.stop_details?.category);
        for (const block of msg.content) if (block.type === "text") text += block.text;

        if (msg.stop_reason === "max_tokens") {
          text += "\n\n> (분량 제한으로 일부가 잘렸습니다)";
          break;
        }
        if (msg.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: msg.content });
      }
    } catch (err) {
      throw toUserFacing(err);
    }

    text = text.trim();
    if (!req.jsonSchema) return { text };
    try {
      return { text, structured: JSON.parse(text) };
    } catch {
      // 분량 제한으로 잘렸거나 형식이 깨진 경우: 날것의 SyntaxError 대신 알아볼 수 있는 메시지로
      throw new UserFacingError("AI 응답이 정해진 형식(JSON)이 아니어서 읽지 못했습니다. 다시 시도해 주세요");
    }
  },
};

function toUserFacing(err: unknown): unknown {
  if (err instanceof Anthropic.AuthenticationError) return new UserFacingError("API 키가 올바르지 않습니다 (.env.local 확인)");
  if (err instanceof Anthropic.PermissionDeniedError) return new UserFacingError("API 키에 이 모델·기능 사용 권한이 없습니다");
  if (err instanceof Anthropic.RateLimitError)
    return new UserFacingError("요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요");
  if (err instanceof Anthropic.APIConnectionError) return new UserFacingError("Claude 서버에 연결하지 못했습니다 (네트워크 확인)");
  if (err instanceof Anthropic.APIError) return new UserFacingError(`Claude API 오류 (${err.status ?? "?"}): ${err.message}`);
  return err;
}
