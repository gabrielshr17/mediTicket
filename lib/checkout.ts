import type { Appointment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function createCheckoutSessionForAppointment(
  appointment: Appointment,
  baseUrl: string
): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: appointment.patientEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: appointment.priceCents,
          product_data: {
            name: appointment.serviceName,
            description: `${appointment.durationMinutes} min appointment on ${appointment.date} at ${appointment.time}`,
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

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { stripeSessionId: session.id },
  });

  return session.url;
}

export async function syncAppointmentPayment(appointment: Appointment): Promise<Appointment> {
  if (appointment.status === "paid" || !appointment.stripeSessionId) return appointment;

  try {
    const session = await getStripe().checkout.sessions.retrieve(appointment.stripeSessionId);
    if (session.payment_status !== "paid") return appointment;

    return await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "paid" },
    });
  } catch (error) {
    console.error("[lib/checkout] could not verify payment with Stripe", error);
    return appointment;
  }
}
