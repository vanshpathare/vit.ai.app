// config/redis.js
import { createClient } from "redis";

const connectionUrl = process.env.REDIS_URL;

if (!connectionUrl) {
  console.error(
    "❌ CRITICAL: REDIS_URL environment variable is missing in config/redis.js!",
  );
}

const redisClient = createClient({
  url: connectionUrl,
});

redisClient.on("error", (err) => {
  // Gracefully log instead of letting unhandled client errors crash background loops
  console.error("❌ Redis Client Error:", err.message);
});

// Connect safely with a catch block so it doesn't break server bootup if Redis hiccups
async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("⚡ Connected to Redis Successfully");
  } catch (err) {
    console.error(
      "⚠️ Redis initial connection failed, running in fallback mode:",
      err.message,
    );
  }
}

connectRedis();

export default redisClient;
