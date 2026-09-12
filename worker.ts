import { Worker } from "bullmq";
import { connection, EMAIL_QUEUE, QUEUE_PREFIX } from "./lib/queue/connection";
import { sendBookingEmail } from "./lib/email";
import type { BookingEmailJob } from "./lib/queue/emailQueue";

const worker = new Worker<BookingEmailJob>(
  EMAIL_QUEUE,
  async (job) => {
    console.log(
      `[worker] processing ${job.id} attempt ${job.attemptsMade + 1} -> ${job.data.to}`
    );
    const messageId = await sendBookingEmail(job.data);
    console.log(`[worker] delivered ${job.id}: ${messageId}`);
    return { messageId };
  },
  { connection, prefix: QUEUE_PREFIX, concurrency: 5 }
);

worker.on("completed", (job) => {
  console.log(`[worker] completed ${job.id}`);
});

worker.on("failed", (job, error) => {
  const attempts = job ? `${job.attemptsMade}/${job.opts.attempts}` : "?";
  console.error(`[worker] failed ${job?.id} attempt ${attempts}: ${error.message}`);
});

console.log(`[worker] listening on queue "${EMAIL_QUEUE}"`);
