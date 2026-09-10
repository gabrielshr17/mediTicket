import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBuscarHorarios } from "@/mcp/tools/buscarHorarios";
import { registerListarInformacion } from "@/mcp/tools/listarInformacion";
import { registerAgendarCita } from "@/mcp/tools/agendarCita";
import { registerLinkPago } from "@/mcp/tools/linkPago";

export function createMcpServer(baseUrl: string): McpServer {
  const server = new McpServer({ name: "mediticket", version: "0.1.0" });

  registerBuscarHorarios(server);
  registerListarInformacion(server);
  registerAgendarCita(server);
  registerLinkPago(server, baseUrl);

  return server;
}
