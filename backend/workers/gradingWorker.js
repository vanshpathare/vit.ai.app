// workers/gradingWorker.js
import { Worker } from "bullmq";
import {
  evaluateWithRouter,
  evaluateConversationTurn,
} from "../services/aiRouter.js";

const connectionUrl = process.env.REDIS_URL;

// Spawn the background worker with a strict rate limit
const gradingWorker = new Worker(
  "ai-grading-queue",
  async (job) => {
    const {
      assignment,
      submissionId,
      responses,
      audioFile,
      modality,
      preferredModel,
      criteriaMap,
      history,
    } = job.data;

    console.log(
      `⚙️ [Worker] Processing grading job ${job.id} for submission ${submissionId}`,
    );

    // Execute the AI pipeline based on modality
    if (modality === "Text-Only") {
      return await evaluateWithRouter({
        question: assignment.questionPool,
        responseInput: responses,
        criteriaMap,
        aiNotes: assignment.aiNotes,
        modality: "Text-Only",
        preferredModel,
      });
    } else if (modality === "Speech-Only") {
      return await evaluateConversationTurn({
        assignmentTitle: assignment.title,
        aiNotes: assignment.aiNotes,
        criteriaMap,
        questionPool: assignment.questionPool,
        totalQuestions: assignment.speechQuestionCount,
        history: history || [],
        audioFile,
        preferredModel,
      });
    }
  },
  {
    connection: connectionUrl,
    concurrency: 2, // Process max 2 concurrent jobs per worker instance
    limiter: {
      max: 15, // Maximum 15 requests
      duration: 60000, // Per 1 minute -> Strict 15 RPM cap!
    },
  },
);

gradingWorker.on("completed", (job) => {
  console.log(`✅ [Worker] Job ${job.id} completed successfully.`);
});

gradingWorker.on("failed", (job, err) => {
  console.error(`❌ [Worker] Job ${job.id} failed with error: ${err.message}`);
});
