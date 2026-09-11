import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { resetRateLimits } from "@/lib/rateLimit";

beforeEach(() => {
  resetRateLimits();
});

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("POST /api/checkout", () => {
  it("rejects a booking request that did not come from the site", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(403);
  });

  it("rate limits repeated booking attempts from the same client", async () => {
    const fromSite = { origin: "http://localhost:3000" };

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({}, fromSite));
      expect(res.status).toBe(400);
    }

    const limited = await POST(makeRequest({}, fromSite));

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});
