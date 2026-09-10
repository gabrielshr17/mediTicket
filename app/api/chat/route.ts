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

const MODEL = process.env.OPENAI_MODEL ?? "gpt-6-astra";
const MAX_TOOL_ROUNDTRIPS = 6;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_RESPONSE_TOKENS = 4096;

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
  return NextResponse.json({ available: Boolean(process.env.OPENAI_API_KEY) });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
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

  const baseUrl = getBaseUrl(req);

  let openai: OpenAI;
  let mcp: McpSession;
  try {
    openai = new OpenAI({ apiKey });
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
        const tools: FunctionTool[] = mcpTools.map((tool) => ({
          type: "function",
          name: tool.name,
          description: tool.description ?? "",
          parameters: tool.inputSchema as Record<string, unknown>,
          strict: false,
        }));

        const input: ResponseInput = history.map(
          (m): EasyInputMessage => ({ role: m.role, content: m.content })
        );

        let sawFunctionCall = false;

        for (let round = 0; round < MAX_TOOL_ROUNDTRIPS && !cancelled; round++) {
          const responseStream = openai.responses.stream({
            model: MODEL,
            max_output_tokens: MAX_RESPONSE_TOKENS,
            instructions: SYSTEM_PROMPT,
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
            instructions: SYSTEM_PROMPT,
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
        const message =
          error instanceof OpenAI.RateLimitError
            ? "Estamos recibiendo muchas solicitudes en este momento. Intenta de nuevo en unos segundos."
            : "Ocurrió un error al procesar tu mensaje.";
        controller.enqueue(encodeEvent({ type: "error", message }));
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
