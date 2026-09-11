import type { NextRequest } from "next/server";

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedOrigins(req: NextRequest): Set<string> {
  const candidates: string[] = [];

  const configured = process.env.ALLOWED_ORIGINS;
  if (configured) {
    candidates.push(...configured.split(",").map((entry) => entry.trim()));
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    candidates.push(process.env.NEXT_PUBLIC_BASE_URL);
  }

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
    candidates.push(`${forwardedProto}://${forwardedHost}`);
  }

  candidates.push(req.nextUrl.origin);

  const origins = new Set<string>();
  for (const candidate of candidates) {
    const origin = candidate && toOrigin(candidate);
    if (origin) origins.add(origin);
  }
  return origins;
}

export function isSameOriginRequest(req: NextRequest): boolean {
  const allowed = allowedOrigins(req);

  const origin = req.headers.get("origin");
  if (origin) return allowed.has(origin);

  const referer = req.headers.get("referer");
  if (referer) {
    const refererOrigin = toOrigin(referer);
    return refererOrigin !== null && allowed.has(refererOrigin);
  }

  return false;
}
