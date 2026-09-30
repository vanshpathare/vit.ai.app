// config/redis.js
import { createClient } from "redis";

const connectionUrl = process.env.REDIS_URL;

if (!connectionUrl) {
  console.error("❌ CRITICAL: REDIS_URL environment variable is missing!");
}

const redisClient = createClient({
  url: connectionUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.error("Redis: giving up after 3 retries");
        return false; // Stop endless retry loops
      }
      return Math.min(retries * 200, 1000);
    },
  },
});

redisClient.on("error", (err) =>
  console.error("❌ Redis Client Error:", err.message),
);

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("⚡ Connected to Redis Successfully");
  } catch (err) {
    console.error("⚠️ Redis connection failed:", err.message);
  }
}

connectRedis();

export default redisClient;
