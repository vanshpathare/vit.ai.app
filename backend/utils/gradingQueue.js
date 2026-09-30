// /**
//  * Dynamic Lightweight In-Memory Task Queue
//  * Throttles concurrent execution to respect external API rate restrictions (15 RPM)
//  */
// class GradingQueue {
//   constructor(maxConcurrency = 2, maxRpm = 15) {
//     this.queue = [];
//     this.activeCount = 0;
//     this.maxConcurrency = maxConcurrency; // Processes 2 requests at a time to prevent bursting past 15 RPM

//     this.maxRpm = maxRpm;          // Hard ceiling (e.g., 15 requests per minute)
//     this.timeWindow = 60000;       // 1 minute in milliseconds
//     this.requestTimestamps = [];   // Tracks exact times of recent requests
//   }

//   /**
//    * Pushes a grading task into the FIFO queue matrix
//    * @param {Function} taskFunction - An isolated async function wrapping the AI call
//    * @returns {Promise<any>} The resolved result from the async task
//    */
//   enqueue(taskFunction) {
//     return new Promise((resolve, reject) => {
//       this.queue.push({ taskFunction, resolve, reject });
//       this.processNext();
//     });
//   }

//   async processNext() {
//     if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
//       return;
//     }

//     // Check RPM Window restriction before launching task
//     const now = Date.now();
//     this.requestTimestamps = this.requestTimestamps.filter(
//       (timestamp) => now - timestamp < this.timeWindow
//     );

//     // If we hit our RPM ceiling, pause until the oldest request rolls out of the 1-minute window
//     if (this.requestTimestamps.length >= this.maxRpm) {
//       const oldestTimestamp = this.requestTimestamps[0];
//       const waitTime = this.timeWindow - (now - oldestTimestamp) + 200; // 200ms safety buffer

//       console.warn(`⏳ [Rate Limit Guard] RPM ceiling of ${this.maxRpm} reached. Pausing queue for ${Math.ceil(waitTime / 1000)}s...`);

//       setTimeout(() => this.processNext(), waitTime);
//       return;
//     }

//     this.requestTimestamps.push(Date.now());
//     this.activeCount++;

//     const { taskFunction, resolve, reject } = this.queue.shift();

//     try {
//       // Execute the task with a built-in automatic retry engine
//       const result = await this.executeWithRetry(taskFunction);
//       resolve(result);
//     } catch (error) {
//       reject(error);
//     } finally {
//       this.activeCount--;
//       // Trigger a tiny 1-second pacing delay before pulling the next item to space out traffic
//       setTimeout(() => this.processNext(), 1000);
//     }
//   }

//   /**
//    * Resilient execution engine utilizing Exponential Backoff to counter 429 anomalies
//    */
//   async executeWithRetry(taskFunction, retries = 3, delay = 2000) {
//     try {
//       return await taskFunction();
//     } catch (error) {
//       // If we encounter a Rate Limit (429) or Server error, check if we have retry fuel left
//       if (
//         retries > 0 &&
//         (error.message.includes("429") ||
//           error.message.includes("Too Many Requests"))
//       ) {
//         console.warn(
//           `⚠️ API rate limit encountered. Retrying task in ${delay}ms... (${retries} attempts left)`,
//         );
//         await new Promise((res) => setTimeout(res, delay));
//         return this.executeWithRetry(taskFunction, retries - 1, delay * 2); // Double the delay duration
//       }
//       throw error; // Propagate the fault if retries are depleted or it's a different runtime error
//     }
//   }
// }

// // Export a single global instance so all incoming student requests share the exact same queue manager
// export const gradingQueue = new GradingQueue();

// utils/gradingQueue.js
import "dotenv/config";
import { Queue } from "bullmq";

// Automatically detects Render's REDIS_URL or defaults to local Redis instance
const connectionUrl = process.env.REDIS_URL || "redis://localhost:6379";

if (!connectionUrl) {
  console.error(
    "❌ CRITICAL: REDIS_URL environment variable is missing on Render!",
  );
}

// Create and export the persistent BullMQ queue instance
export const gradingQueue = new Queue("ai-grading-queue", {
  connection: {
    url: process.env.REDIS_URL, // 👈 Explicitly pass the URL inside an object configuration
  },
});
