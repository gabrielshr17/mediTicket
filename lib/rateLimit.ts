import type { NextRequest } from "next/server";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type RateLimitReason = "per_minute" | "per_day" | "global_daily";

export interface RateLimitResult {
  ok: boolean;
  reason?: RateLimitReason;
  retryAfterSeconds?: number;
}

export interface RateLimitConfig {
  perMinute: number;
  perDay: number;
  globalPerDay: number;
  maxTrackedClients: number;
}

interface ClientState {
  recent: number[];
  dayCount: number;
  dayStart: number;
  lastSeen: number;
}

interface GlobalState {
  dayCount: number;
  dayStart: number;
}

const clients = new Map<string, ClientState>();
const globals = new Map<string, GlobalState>();

function envNumber(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultConfig(): RateLimitConfig {
  return {
    perMinute: envNumber("CHAT_RATE_LIMIT_PER_MINUTE", 10),
    perDay: envNumber("CHAT_RATE_LIMIT_PER_DAY", 60),
    globalPerDay: envNumber("CHAT_RATE_LIMIT_GLOBAL_PER_DAY", 500),
    maxTrackedClients: envNumber("CHAT_RATE_LIMIT_MAX_CLIENTS", 10_000),
  };
}

function evictIfNeeded(nowMs: number, maxTrackedClients: number): void {
  if (clients.size < maxTrackedClients) return;

  for (const [id, state] of clients) {
    if (nowMs - state.lastSeen >= DAY_MS) clients.delete(id);
  }

  while (clients.size >= maxTrackedClients) {
    let oldestId: string | undefined;
    let oldestSeen = Number.POSITIVE_INFINITY;
    for (const [id, state] of clients) {
      if (state.lastSeen < oldestSeen) {
        oldestSeen = state.lastSeen;
        oldestId = id;
      }
    }
    if (oldestId === undefined) return;
    clients.delete(oldestId);
  }
}

export function checkRateLimit(
  scope: string,
  clientId: string,
  now: Date = new Date(),
  overrides?: Partial<RateLimitConfig>
): RateLimitResult {
  const config = { ...defaultConfig(), ...overrides };
  const nowMs = now.getTime();

  let global = globals.get(scope);
  if (!global || nowMs - global.dayStart >= DAY_MS) {
    global = { dayCount: 0, dayStart: nowMs };
    globals.set(scope, global);
  }

  const key = `${scope}:${clientId}`;
  let state = clients.get(key);
  if (!state) {
    evictIfNeeded(nowMs, config.maxTrackedClients);
    state = { recent: [], dayCount: 0, dayStart: nowMs, lastSeen: nowMs };
    clients.set(key, state);
  }

  if (nowMs - state.dayStart >= DAY_MS) {
    state.dayStart = nowMs;
    state.dayCount = 0;
  }

  state.lastSeen = nowMs;
  state.recent = state.recent.filter((timestamp) => nowMs - timestamp < MINUTE_MS);

  if (state.recent.length >= config.perMinute) {
    return {
      ok: false,
      reason: "per_minute",
      retryAfterSeconds: Math.ceil((state.recent[0] + MINUTE_MS - nowMs) / 1000),
    };
  }

  if (state.dayCount >= config.perDay) {
    return {
      ok: false,
      reason: "per_day",
      retryAfterSeconds: Math.ceil((state.dayStart + DAY_MS - nowMs) / 1000),
    };
  }

  if (global.dayCount >= config.globalPerDay) {
    return {
      ok: false,
      reason: "global_daily",
      retryAfterSeconds: Math.ceil((global.dayStart + DAY_MS - nowMs) / 1000),
    };
  }

  state.recent.push(nowMs);
  state.dayCount++;
  global.dayCount++;
  return { ok: true };
}

export function getClientId(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function resetRateLimits(): void {
  clients.clear();
  globals.clear();
}

export function trackedClientCount(): number {
  return clients.size;
}
