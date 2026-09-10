import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getBaseUrl } from "@/lib/baseUrl";

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("getBaseUrl", () => {
  it("prefers NEXT_PUBLIC_BASE_URL when set", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://configured.example.com";
    try {
      const req = makeRequest("http://localhost:10000/api/checkout", {
        "x-forwarded-host": "mediticket-r0ih.onrender.com",
        "x-forwarded-proto": "https",
      });

      expect(getBaseUrl(req)).toBe("https://configured.example.com");
    } finally {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    }
  });

  it("derives the origin from X-Forwarded-Host/Proto when the request's own Host is an internal proxy address", () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const req = makeRequest("http://localhost:10000/api/checkout", {
      "x-forwarded-host": "mediticket-r0ih.onrender.com",
      "x-forwarded-proto": "https",
    });

    expect(getBaseUrl(req)).toBe("https://mediticket-r0ih.onrender.com");
  });

  it("falls back to the request's own origin when there is no forwarding header (local dev)", () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    const req = makeRequest("http://localhost:3000/api/checkout");

    expect(getBaseUrl(req)).toBe("http://localhost:3000");
  });
});
