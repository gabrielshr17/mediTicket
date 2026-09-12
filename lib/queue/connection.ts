const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

const useTls = redisUrl.protocol === "rediss:";

export const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
  ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
  ...(useTls ? { tls: {} } : {}),
  maxRetriesPerRequest: null,
};

export const EMAIL_QUEUE = "booking-emails";
export const QUEUE_PREFIX = "mediticket";
