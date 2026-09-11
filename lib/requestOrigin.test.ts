import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/requestOrigin";

const LIVE = "https://mediticket-r0ih.onrender.com";

function makeRequest(headers: Record<string, string>) {
  return new NextRequest("http://localhost:10000/api/checkout", {
    method: "POST",
    headers,
  });
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BASE_URL;
  delete process.env.ALLOWED_ORIGINS;
});

describe("isSameOriginRequest", () => {
  it("allows a browser request from the deployed site, even though the internal host differs", () => {
    const req = makeRequest({
      origin: LIVE,
      "x-forwarded-host": "mediticket-r0ih.onrender.com",
      "x-forwarded-proto": "https",
    });

    expect(isSameOriginRequest(req)).toBe(true);
  });

  it("rejects a request with no Origin and no Referer, which is what curl and Postman send", () => {
    const req = makeRequest({
      "x-forwarded-host": "mediticket-r0ih.onrender.com",
      "x-forwarded-proto": "https",
    });

    expect(isSameOriginRequest(req)).toBe(false);
  });

  it("rejects a request from another website", () => {
    const req = makeRequest({
      origin: "https://evil.example.com",
      "x-forwarded-host": "mediticket-r0ih.onrender.com",
      "x-forwarded-proto": "https",
    });

    expect(isSameOriginRequest(req)).toBe(false);
  });

  it("falls back to the Referer header when Origin is absent", () => {
    const req = makeRequest({
      referer: `${LIVE}/`,
      "x-forwarded-host": "mediticket-r0ih.onrender.com",
      "x-forwarded-proto": "https",
    });

    expect(isSameOriginRequest(req)).toBe(true);
  });

  it("allows the origin configured in NEXT_PUBLIC_BASE_URL", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://booking.example.com";
    const req = makeRequest({ origin: "https://booking.example.com" });

    expect(isSameOriginRequest(req)).toBe(true);
  });

  it("allows extra origins listed in ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = "https://partner.example.com, https://other.example.com";
    const req = makeRequest({ origin: "https://partner.example.com" });

    expect(isSameOriginRequest(req)).toBe(true);
  });

  it("allows localhost during development", () => {
    const req = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    expect(isSameOriginRequest(req)).toBe(true);
  });
});
