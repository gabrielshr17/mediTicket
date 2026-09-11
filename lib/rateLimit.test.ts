import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits, trackedClientCount } from "@/lib/rateLimit";

const CONFIG = { perMinute: 3, perDay: 5, globalPerDay: 8, maxTrackedClients: 4 };
const T0 = new Date("2026-09-11T10:00:00Z");

function at(secondsFromT0: number) {
  return new Date(T0.getTime() + secondsFromT0 * 1000);
}

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows requests below the per-minute limit", () => {
    for (let i = 0; i < CONFIG.perMinute; i++) {
      expect(checkRateLimit("chat", "1.1.1.1", at(i), CONFIG).ok).toBe(true);
    }
  });

  it("blocks the request that exceeds the per-minute limit and says when to retry", () => {
    for (let i = 0; i < CONFIG.perMinute; i++) {
      checkRateLimit("chat", "1.1.1.1", at(i), CONFIG);
    }

    const result = checkRateLimit("chat", "1.1.1.1", at(10), CONFIG);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("per_minute");
    expect(result.retryAfterSeconds).toBe(50);
  });

  it("allows requests again once the minute window has slid past", () => {
    for (let i = 0; i < CONFIG.perMinute; i++) {
      checkRateLimit("chat", "1.1.1.1", at(i), CONFIG);
    }
    expect(checkRateLimit("chat", "1.1.1.1", at(10), CONFIG).ok).toBe(false);

    expect(checkRateLimit("chat", "1.1.1.1", at(61), CONFIG).ok).toBe(true);
  });

  it("blocks once the per-client daily limit is reached", () => {
    for (let i = 0; i < CONFIG.perDay; i++) {
      expect(checkRateLimit("chat", "1.1.1.1", at(i * 120), CONFIG).ok).toBe(true);
    }

    const result = checkRateLimit("chat", "1.1.1.1", at(CONFIG.perDay * 120), CONFIG);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("per_day");
  });

  it("tracks each client independently", () => {
    for (let i = 0; i < CONFIG.perMinute; i++) {
      checkRateLimit("chat", "1.1.1.1", at(i), CONFIG);
    }
    expect(checkRateLimit("chat", "1.1.1.1", at(10), CONFIG).ok).toBe(false);

    expect(checkRateLimit("chat", "2.2.2.2", at(10), CONFIG).ok).toBe(true);
  });

  it("blocks a brand new client once the global daily ceiling is reached", () => {
    let allowed = 0;
    for (let client = 0; client < 10; client++) {
      for (let i = 0; i < CONFIG.perDay; i++) {
        if (checkRateLimit("chat", `10.0.0.${client}`, at(client * 600 + i * 120), CONFIG).ok) {
          allowed++;
        }
      }
    }

    expect(allowed).toBe(CONFIG.globalPerDay);
    expect(checkRateLimit("chat", "9.9.9.9", at(7000), CONFIG).reason).toBe("global_daily");
  });

  it("keeps the tracked-client map bounded so rotating IPs cannot exhaust memory", () => {
    for (let client = 0; client < 50; client++) {
      checkRateLimit("chat", `172.16.0.${client}`, at(client), CONFIG);
    }

    expect(trackedClientCount()).toBeLessThanOrEqual(CONFIG.maxTrackedClients);
  });
  it("keeps each endpoint scope on its own budget", () => {
    for (let i = 0; i < CONFIG.perMinute; i++) {
      checkRateLimit("chat", "1.1.1.1", at(i), CONFIG);
    }
    expect(checkRateLimit("chat", "1.1.1.1", at(10), CONFIG).ok).toBe(false);

    expect(checkRateLimit("checkout", "1.1.1.1", at(10), CONFIG).ok).toBe(true);
  });
});
