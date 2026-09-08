import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { connectMcpSession, type McpSession } from "@/mcp/client";
import type { ChatMessage, ChatStreamEvent } from "@/lib/chatEvents";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const MAX_TOOL_ROUNDTRIPS = 6;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;

const SYSTEM_PROMPT = `Eres el asistente virtual de mediTicket, una clínica que permite reservar citas médicas en línea.
Responde siempre en español, de forma breve y clara.
Usa las herramientas disponibles para responder con información real: nunca inventes horarios, precios, servicios ni datos de citas.
Para reservar una cita necesitas: servicio, nombre completo, correo electrónico, fecha y hora. Pide los datos que falten antes de llamar a agendar_cita.
Después de reservar una cita con agendar_cita, ofrece generar el link de pago con link_pago.`;

function encodeEvent(data: ChatStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function isValidHistory(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return false;
  }
  return messages.every(
    (m): m is ChatMessage =>
      typeof m === "object" &&
      m !== null &&
      (m as ChatMessage).role !== undefined &&
      ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
      typeof (m as ChatMessage).content === "string" &&
      (m as ChatMessage).content.trim().length > 0 &&
      (m as ChatMessage).content.length <= MAX_MESSAGE_LENGTH
  );
}

export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "El asistente no está disponible en este momento." },
      { status: 503 }
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch (error) {
    console.error("[api/chat] invalid JSON body", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isValidHistory(body.messages) || body.messages[body.messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Invalid chat history" }, { status: 400 });
  }
  const history = body.messages;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;

  let anthropic: Anthropic;
  let mcp: McpSession;
  try {
    anthropic = new Anthropic({ apiKey });
    mcp = await connectMcpSession(baseUrl);
  } catch (error) {
    console.error("[api/chat] failed to start chat session", error);
    return NextResponse.json(
      { error: "El asistente no está disponible en este momento." },
      { status: 503 }
    );
  }

  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const mcpTools = await mcp.listTools();
        const tools: Tool[] = mcpTools.map((tool) => ({
          name: tool.name,
          description: tool.description ?? "",
          input_schema: tool.inputSchema as Tool["input_schema"],
        }));

        const messages: MessageParam[] = history.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let lastStopReason: string | null = null;

        for (let round = 0; round < MAX_TOOL_ROUNDTRIPS && !cancelled; round++) {
          const responseStream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            tools,
            messages,
          });

          responseStream.on("text", (delta) => {
            controller.enqueue(encodeEvent({ type: "text", text: delta }));
          });

          const finalMessage = await responseStream.finalMessage();
          messages.push({ role: "assistant", content: finalMessage.content });
          lastStopReason = finalMessage.stop_reason;

          if (finalMessage.stop_reason !== "tool_use" || cancelled) break;

          const toolUseBlocks = finalMessage.content.filter(
            (block): block is ToolUseBlock => block.type === "tool_use"
          );

          const toolResults: ToolResultBlockParam[] = [];
          for (const block of toolUseBlocks) {
            if (cancelled) break;

            controller.enqueue(encodeEvent({ type: "tool_call", tool: block.name, input: block.input }));

            const result = await mcp.callTool(block.name, block.input as Record<string, unknown>);

            controller.enqueue(
              encodeEvent({ type: "tool_result", tool: block.name, isError: result.isError, text: result.text })
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result.text,
              is_error: result.isError,
            });
          }
          messages.push({ role: "user", content: toolResults });
        }

        if (lastStopReason === "tool_use" && !cancelled) {
          const finalStream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages,
          });
          finalStream.on("text", (delta) => {
            controller.enqueue(encodeEvent({ type: "text", text: delta }));
          });
          await finalStream.finalMessage();
        }

        controller.enqueue(encodeEvent({ type: "done" }));
      } catch (error) {
        console.error("[api/chat] agent loop failed", error);
        controller.enqueue(encodeEvent({ type: "error", message: "Ocurrió un error al procesar tu mensaje." }));
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
