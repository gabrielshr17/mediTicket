import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  EasyInputMessage,
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInput,
} from "openai/resources/responses/responses";
import { connectMcpSession, type McpSession } from "@/mcp/client";
import type { ChatMessage, ChatStreamEvent } from "@/lib/chatEvents";
import { getBaseUrl } from "@/lib/baseUrl";
import { buildSystemPrompt } from "@/lib/chatPrompt";
import { checkRateLimit, getClientId, type RateLimitReason } from "@/lib/rateLimit";
import { isSameOriginRequest } from "@/lib/requestOrigin";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
const MAX_TOOL_ROUNDTRIPS = 4;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_TOTAL_CHARS = 8000;
const MAX_RESPONSE_TOKENS = 800;

const UNAVAILABLE = "The assistant is temporarily unavailable. You can still book using the form above.";
const CONVERSATION_TOO_LONG = "This conversation has gotten too long. Start a new chat to continue.";

type HistoryCheck = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };

function encodeEvent(data: ChatStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as ChatMessage;
  return (
    (message.role === "user" || message.role === "assistant") && typeof message.content === "string"
  );
}

function validateHistory(messages: unknown): HistoryCheck {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "No message was sent." };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, error: CONVERSATION_TOO_LONG };
  }

  let totalChars = 0;
  for (const message of messages) {
    if (!isChatMessage(message)) {
      return { ok: false, error: "This conversation contains a message we could not read." };
    }
    if (message.content.trim().length === 0) {
      return { ok: false, error: "Your message is empty." };
    }
    if (message.content.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: `Your message is too long (${message.content.length} characters, max ${MAX_MESSAGE_LENGTH}).`,
      };
    }
    totalChars += message.content.length;
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return { ok: false, error: CONVERSATION_TOO_LONG };
  }
  if (messages[messages.length - 1].role !== "user") {
    return { ok: false, error: "Expected your message to come last." };
  }

  return { ok: true, messages: messages as ChatMessage[] };
}

function rateLimitMessage(reason: RateLimitReason): string {
  switch (reason) {
    case "per_minute":
      return "You are sending messages too quickly. Wait a few seconds and try again.";
    case "per_day":
      return "You have reached today's message limit. Please try again tomorrow, or use the booking form above.";
    case "global_daily":
      return UNAVAILABLE;
  }
}

function isQuotaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; type?: unknown };
  return candidate.code === "credit_balance_exhausted" || candidate.type === "insufficient_quota";
}

function withDevDetail(message: string, error: unknown): string {
  if (process.env.NODE_ENV === "production") return message;
  const detail = error instanceof Error ? error.message : String(error);
  return `${message} [dev detail: ${detail}]`;
}

export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.OPENAI_API_KEY) });
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }

  if (!isSameOriginRequest(req)) {
    return NextResponse.json(
      { error: "This request must come from the mediTicket website." },
      { status: 403 }
    );
  }

  const limit = checkRateLimit("chat", getClientId(req));
  if (!limit.ok && limit.reason) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.reason) },
      {
        status: limit.reason === "global_daily" ? 503 : 429,
        headers: limit.retryAfterSeconds
          ? { "Retry-After": String(limit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch (error) {
    console.error("[api/chat] invalid JSON body", error);
    return NextResponse.json({ error: "We could not read your message." }, { status: 400 });
  }

  const history = validateHistory(body.messages);
  if (!history.ok) {
    return NextResponse.json({ error: history.error }, { status: 400 });
  }

  const baseUrl = getBaseUrl(req);

  let openai: OpenAI;
  let mcp: McpSession;
  let systemPrompt: string;
  try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    systemPrompt = await buildSystemPrompt();
    mcp = await connectMcpSession(baseUrl);
  } catch (error) {
    console.error("[api/chat] failed to start chat session", error);
    return NextResponse.json({ error: withDevDetail(UNAVAILABLE, error) }, { status: 503 });
  }

  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const mcpTools = await mcp.listTools();
        const tools: FunctionTool[] = mcpTools.map((tool) => ({
          type: "function",
          name: tool.name,
          description: tool.description ?? "",
          parameters: tool.inputSchema as Record<string, unknown>,
          strict: false,
        }));

        const input: ResponseInput = history.messages.map(
          (m): EasyInputMessage => ({ role: m.role, content: m.content })
        );

        let sawFunctionCall = false;

        for (let round = 0; round < MAX_TOOL_ROUNDTRIPS && !cancelled; round++) {
          const responseStream = openai.responses.stream({
            model: MODEL,
            max_output_tokens: MAX_RESPONSE_TOKENS,
            instructions: systemPrompt,
            tools,
            input,
          });

          responseStream.on("response.output_text.delta", (event) => {
            controller.enqueue(encodeEvent({ type: "text", text: event.delta }));
          });

          const response = await responseStream.finalResponse();
          input.push(...(response.output as unknown as ResponseInput));

          const functionCalls = response.output.filter(
            (item) => item.type === "function_call"
          ) as unknown as ResponseFunctionToolCall[];

          sawFunctionCall = functionCalls.length > 0;
          if (!sawFunctionCall || cancelled) break;

          for (const call of functionCalls) {
            if (cancelled) break;

            const args = JSON.parse(call.arguments) as Record<string, unknown>;
            controller.enqueue(encodeEvent({ type: "tool_call", tool: call.name, input: args }));

            const result = await mcp.callTool(call.name, args);

            controller.enqueue(
              encodeEvent({ type: "tool_result", tool: call.name, isError: result.isError, text: result.text })
            );

            input.push({
              type: "function_call_output",
              call_id: call.call_id,
              output: result.text,
            });
          }
        }

        if (sawFunctionCall && !cancelled) {
          const finalStream = openai.responses.stream({
            model: MODEL,
            max_output_tokens: MAX_RESPONSE_TOKENS,
            instructions: systemPrompt,
            input,
          });
          finalStream.on("response.output_text.delta", (event) => {
            controller.enqueue(encodeEvent({ type: "text", text: event.delta }));
          });
          await finalStream.finalResponse();
        }

        controller.enqueue(encodeEvent({ type: "done" }));
      } catch (error) {
        console.error("[api/chat] agent loop failed", error);
        const base =
          error instanceof OpenAI.RateLimitError
            ? "The assistant is busy right now. Please try again in a few seconds."
            : isQuotaError(error)
              ? UNAVAILABLE
              : "Something went wrong on our end. Please try again, or use the booking form above.";
        controller.enqueue(encodeEvent({ type: "error", message: withDevDetail(base, error) }));
      } finally {
        await mcp.close();
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
