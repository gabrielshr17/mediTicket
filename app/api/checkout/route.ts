import { NextRequest, NextResponse } from "next/server";
import { createPendingAppointment } from "@/lib/appointments";
import { createCheckoutSessionForAppointment } from "@/lib/checkout";
import { getBaseUrl } from "@/lib/baseUrl";
import { checkRateLimit, getClientId } from "@/lib/rateLimit";
import { isSameOriginRequest } from "@/lib/requestOrigin";

const CHECKOUT_LIMITS = { perMinute: 5, perDay: 20, globalPerDay: 2000 };

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json(
      { error: "This request must come from the mediTicket website." },
      { status: 403 }
    );
  }

  const limit = checkRateLimit("checkout", getClientId(req), new Date(), CHECKOUT_LIMITS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please wait a moment and try again." },
      {
        status: 429,
        headers: limit.retryAfterSeconds
          ? { "Retry-After": String(limit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  try {
    const body = await req.json();
    const result = await createPendingAppointment(body ?? {});

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const baseUrl = getBaseUrl(req);
    const url = await createCheckoutSessionForAppointment(result.appointment, baseUrl);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[api/checkout] failed to create checkout session", error);
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 });
  }
}
