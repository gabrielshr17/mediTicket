import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/mcp/server";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return false;

  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}

async function handle(req: NextRequest): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
    const server = createMcpServer(baseUrl);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (error) {
    console.error("[api/mcp] failed to handle MCP request", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
