import { describe, it, expect, afterEach } from "vitest";
import { connectMcpSession, type McpSession } from "@/mcp/client";

let session: McpSession | undefined;

afterEach(async () => {
  await session?.close();
  session = undefined;
});

describe("connectMcpSession", () => {
  it("lists the mediTicket tools with their schemas", async () => {
    session = await connectMcpSession("http://localhost:3000");

    const tools = await session.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual([
      "agendar_cita",
      "buscar_horarios",
      "consultar_cita",
      "link_pago",
      "listar_informacion",
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema).toBeTruthy();
    }
  });

  it("calls a read-only tool and returns its text content", async () => {
    session = await connectMcpSession("http://localhost:3000");

    const result = await session.callTool("listar_informacion", {});

    expect(result.isError).toBe(false);
    expect(result.text).toContain("Available services");
  });

  it("reports isError for a tool call with a missing required argument", async () => {
    session = await connectMcpSession("http://localhost:3000");

    const result = await session.callTool("buscar_horarios", {});

    expect(result.isError).toBe(true);
  });
});
