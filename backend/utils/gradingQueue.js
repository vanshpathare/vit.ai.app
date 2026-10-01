import "dotenv/config";
import { Queue } from "bullmq";
import { bullConnection } from "../config/bullConnection.js";

export const gradingQueue = new Queue("ai-grading-queue", {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30000 }, // lets rate limits cool down
    removeOnComplete: true,
    removeOnFail: { age: 86400 }, // keep failed jobs 24h for inspection
  },
});

gradingQueue.on("error", (err) =>
  console.error("❌ [Queue] error:", err.message),
);
