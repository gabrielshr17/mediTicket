import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { getEmailQueue } from "./lib/queue/emailQueue";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(getEmailQueue())],
  serverAdapter,
});

const app = express();
app.use("/admin/queues", serverAdapter.getRouter());
app.get("/", (_req, res) => {
  res.redirect("/admin/queues");
});

const port = Number(process.env.BULL_BOARD_PORT ?? 3001);
app.listen(port, () => {
  console.log(`[bull-board] dashboard on http://localhost:${port}/admin/queues`);
});
