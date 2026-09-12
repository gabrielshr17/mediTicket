import { Queue } from "bullmq";
import { connection, EMAIL_QUEUE, QUEUE_PREFIX } from "@/lib/queue/connection";

export interface BookingEmailJob {
  appointmentId: string;
  to: string;
  patientName: string;
  serviceName: string;
  date: string;
  time: string;
  priceCents: number;
  simulateFailure?: boolean;
}

let queue: Queue<BookingEmailJob> | null = null;

export function getEmailQueue(): Queue<BookingEmailJob> {
  if (!queue) {
    queue = new Queue<BookingEmailJob>(EMAIL_QUEUE, {
      connection,
      prefix: QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return queue;
}

export async function enqueueBookingEmail(data: BookingEmailJob): Promise<string | null> {
  try {
    const job = await getEmailQueue().add("booking-confirmation", data);
    return job.id ?? null;
  } catch (error) {
    console.error("[queue/email] could not enqueue booking email", error);
    return null;
  }
}
