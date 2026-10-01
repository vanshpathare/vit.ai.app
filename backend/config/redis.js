import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL,
  connectTimeout: 10000, // default is 5000
  socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 3000) },
});

redisClient.on("error", (err) =>
  console.error("❌ Redis Client Error:", err.message),
);

redisClient.connect().then(
  () => console.log("⚡ Connected to Redis Successfully"),
  (err) => console.error("⚠️ Redis connection failed:", err.message),
);

export default redisClient;
