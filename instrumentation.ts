export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEmailWorkerIfEnabled } = await import("./lib/queue/startWorker");
    startEmailWorkerIfEnabled();
  }
}
