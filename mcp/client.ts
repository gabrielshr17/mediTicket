import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@/mcp/server";

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface McpToolCallResult {
  isError: boolean;
  text: string;
}

export interface McpSession {
  listTools(): Promise<McpToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
  close(): Promise<void>;
}

export async function connectMcpSession(baseUrl: string): Promise<McpSession> {
  const server = createMcpServer(baseUrl);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "mediticket-chat", version: "0.1.0" });

  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  return {
    async listTools() {
      const { tools } = await client.listTools();
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    },

    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args });
      const blocks = Array.isArray(result.content) ? result.content : [];
      const text = blocks
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      return { isError: Boolean(result.isError), text };
    },

    async close() {
      await client.close();
      await server.close();
    },
  };
}
