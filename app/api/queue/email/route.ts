import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { enqueueBookingEmail, getEmailQueue } from "@/lib/queue/emailQueue";
import { isValidEmail, normalizeEmail } from "@/lib/emailValidation";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return false;

  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const counts = await getEmailQueue().getJobCounts();
    return NextResponse.json({ queue: "booking-emails", counts });
  } catch (error) {
    console.error("[api/queue/email] could not read queue counts", error);
    return NextResponse.json({ error: "Queue unavailable. Is Redis running?" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("[api/queue/email] invalid JSON body", error);
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidEmail(body.to)) {
    return NextResponse.json(
      { error: "Provide a valid email address in the 'to' field." },
      { status: 400 }
    );
  }

  const jobId = await enqueueBookingEmail({
    appointmentId: String(body.appointmentId ?? "manual-test"),
    to: normalizeEmail(body.to),
    patientName: String(body.patientName ?? "Test Patient"),
    serviceName: String(body.serviceName ?? "General Checkup"),
    date: String(body.date ?? "2026-12-01"),
    time: String(body.time ?? "09:00"),
    priceCents: Number(body.priceCents ?? 5000),
    simulateFailure: body.simulateFailure === true,
  });

  if (!jobId) {
    return NextResponse.json(
      { error: "Could not enqueue the email. Is Redis running?" },
      { status: 503 }
    );
  }

  return NextResponse.json({ queued: true, jobId }, { status: 202 });
}
