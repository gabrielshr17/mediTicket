export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; isError: boolean; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
