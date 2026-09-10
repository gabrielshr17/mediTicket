import { NextRequest, NextResponse } from "next/server";
import { createPendingAppointment } from "@/lib/appointments";
import { createCheckoutSessionForAppointment } from "@/lib/checkout";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createPendingAppointment(body ?? {});

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
    const url = await createCheckoutSessionForAppointment(result.appointment, baseUrl);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[api/checkout] failed to create checkout session", error);
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 });
  }
}
