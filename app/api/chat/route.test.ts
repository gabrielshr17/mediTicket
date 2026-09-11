import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { resetRateLimits } from "@/lib/rateLimit";

const originalKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  resetRateLimits();
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
    headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
  });
}

describe("POST /api/chat", () => {
  it("returns 503 without calling OpenAI or MCP when OPENAI_API_KEY is unset", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hello" }] }));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("temporarily unavailable");
  });

  it("returns 400 when no message was sent", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const res = await POST(makeRequest({ messages: [] }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No message was sent.");
  });

  it("returns 400 when a message has an unsupported role", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const res = await POST(makeRequest({ messages: [{ role: "system", content: "hello" }] }));

    expect(res.status).toBe(400);
  });

  it("tells the user exactly how long their message was when it exceeds the cap", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "a".repeat(1500) }] }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      "Your message is too long (1500 characters, max 1000)."
    );
  });

  it("returns 400 when the history exceeds the message count cap", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const messages = Array.from({ length: 21 }, () => ({ role: "user", content: "hello" }));

    const res = await POST(makeRequest({ messages }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("too long");
  });

  it("returns 400 when the whole conversation exceeds the total character cap", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const messages = Array.from({ length: 20 }, () => ({
      role: "user",
      content: "a".repeat(500),
    }));

    const res = await POST(makeRequest({ messages }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("too long");
  });

  it("returns 429 with Retry-After once the per-minute rate limit is exceeded", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest({ messages: [] }));
      expect(res.status).toBe(400);
    }

    const limited = await POST(makeRequest({ messages: [] }));

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect((await limited.json()).error).toContain("too quickly");
  });

  it("rejects a request that did not come from the site, which is what curl sends", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const noOrigin = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(noOrigin);

    expect(res.status).toBe(403);
  });
});
