import "dotenv/config";

if (!process.env.REDIS_URL) {
  throw new Error("❌ CRITICAL: REDIS_URL environment variable is missing!");
}

const u = new URL(process.env.REDIS_URL);

export const bullConnection = {
  host: u.hostname,
  port: Number(u.port) || 6379,
  username: u.username || undefined,
  password: u.password ? decodeURIComponent(u.password) : undefined,
  tls: u.protocol === "rediss:" ? {} : undefined,
};
