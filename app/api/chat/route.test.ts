import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const originalKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalKey;
  }
});

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chat", () => {
  it("returns 503 without calling OpenAI or MCP when OPENAI_API_KEY is unset", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hola" }] }));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("El asistente no está disponible en este momento.");
  });

  it("returns 400 when there is no trailing user message", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const res = await POST(makeRequest({ messages: [] }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when a message has a non-string role", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const res = await POST(makeRequest({ messages: [{ role: "system", content: "hola" }] }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when a message exceeds the length cap", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "a".repeat(5000) }] }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when the history exceeds the message count cap", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "hola",
    }));

    const res = await POST(makeRequest({ messages }));

    expect(res.status).toBe(400);
  });
});
