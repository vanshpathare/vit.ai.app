import "dotenv/config";
import { Queue } from "bullmq";
import { bullConnection } from "./config/bullConnection.js"; // Or your Redis connection config

const clearQueues = async () => {
  try {
    const uploadQueue = new Queue("upload-grading-queue", {
      connection: bullConnection,
    });
    const gradingQueue = new Queue("ai-grading-queue", {
      connection: bullConnection,
    });

    await uploadQueue.obliterate({ force: true });
    await gradingQueue.obliterate({ force: true });

    console.log("🧹 Successfully wiped and cleared all Redis grading queues!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to clear queue:", err);
    process.exit(1);
  }
};

clearQueues();
