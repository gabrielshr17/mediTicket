import nodemailer, { type Transporter } from "nodemailer";
import type { BookingEmailJob } from "@/lib/queue/emailQueue";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function sendBookingEmail(job: BookingEmailJob): Promise<string> {
  if (job.simulateFailure) {
    throw new Error("Simulated delivery failure for retry testing");
  }

  const info = await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? "mediTicket <no-reply@mediticket.example>",
    to: job.to,
    subject: `Your ${job.serviceName} appointment on ${job.date}`,
    text: [
      `Hi ${job.patientName},`,
      "",
      `Your ${job.serviceName} appointment is booked for ${job.date} at ${job.time}.`,
      `Total: ${formatPrice(job.priceCents)}.`,
      "",
      "See you at the clinic.",
      "mediTicket",
    ].join("\n"),
  });

  return info.messageId ?? "sent";
}
