import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getServiceById } from "@/lib/services";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceId, patientName, patientEmail, date, time } = body ?? {};

    if (
      typeof serviceId !== "string" ||
      typeof patientName !== "string" ||
      typeof patientEmail !== "string" ||
      typeof date !== "string" ||
      typeof time !== "string" ||
      !patientName.trim() ||
      !EMAIL_RE.test(patientEmail) ||
      !date ||
      !time
    ) {
      return NextResponse.json({ error: "Invalid booking details" }, { status: 400 });
    }

    const appointmentDateTime = new Date(`${date}T${time}`);
    if (Number.isNaN(appointmentDateTime.getTime()) || appointmentDateTime.getTime() < Date.now()) {
      return NextResponse.json({ error: "Please choose a valid future date and time" }, { status: 400 });
    }

    const service = await getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    let appointment;
    try {
      appointment = await prisma.appointment.create({
        data: {
          serviceId: service.id,
          serviceName: service.name,
          priceCents: service.priceCents,
          durationMinutes: service.durationMinutes,
          patientName: patientName.trim(),
          patientEmail: patientEmail.trim(),
          date,
          time,
          status: "pending",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json(
          { error: "That slot was just booked by someone else. Please pick another time." },
          { status: 409 }
        );
      }
      throw error;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: appointment.patientEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: service.priceCents,
            product_data: {
              name: service.name,
              description: `${service.durationMinutes} min appointment on ${date} at ${time}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        appointmentId: appointment.id,
      },
      success_url: `${baseUrl}/success?appointment_id=${appointment.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel?appointment_id=${appointment.id}`,
    });

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[api/checkout] failed to create checkout session", error);
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 });
  }
}
