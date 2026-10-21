import { Queue } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

const connection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : { host: "localhost", port: 6379 };

// 🟢 Dedicated BullMQ Queue for Upload/Multimodal Assignments
export const uploadGradingQueue = new Queue("upload-grading-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const enqueueUploadGrading = async ({ assignmentId, teacherId }) => {
  const job = await uploadGradingQueue.add("evaluate-uploads", {
    assignmentId,
    teacherId,
  });
  return job;
};
