import "dotenv/config";
import { Worker } from "bullmq";
import Submission from "../models/Submission.js";
import { evaluateWithRouter } from "../services/aiRouter.js";
import { bullConnection } from "../config/bullConnection.js";

export const gradingWorker = new Worker(
  "ai-grading-queue",
  async (job) => {
    const { submissionId, assignment, responses, criteriaMap, preferredModel } =
      job.data;

    console.log(
      `⚙️ [Worker] Grading submission ${submissionId} (job ${job.id})`,
    );

    // grade against what this student was assigned, not the whole pool
    const sub =
      await Submission.findById(submissionId).select("assignedQuestions");
    const questions = sub?.assignedQuestions?.length
      ? sub.assignedQuestions
      : assignment.questionPool;

    const result = await evaluateWithRouter({
      question: questions,
      responseInput: responses,
      criteriaMap,
      aiNotes: assignment.aiNotes,
      modality: "Text-Only",
      preferredModel,
    });

    // incomplete AI output -> throw so BullMQ retries instead of saving junk
    if (
      !result ||
      !result.scores ||
      typeof result.totalScoreGivenByAI !== "number"
    ) {
      throw new Error("AI returned an incomplete evaluation");
    }

    await Submission.findByIdAndUpdate(submissionId, {
      $set: {
        aiEvaluation: {
          scores: result.scores,
          totalScoreGivenByAI: result.totalScoreGivenByAI,
          feedback: result.feedback,
        },
        status: "submitted",
        submittedAt: new Date(),
        finalScoreOverride: null,
      },
    });

    console.log(`✅ [Worker] Saved grade for submission ${submissionId}`);
  },
  {
    connection: bullConnection,
    concurrency: 2,
    limiter: { max: 15, duration: 60000 }, // set to your real provider limits
  },
);

gradingWorker.on("failed", async (job, err) => {
  console.error(`❌ [Worker] Job ${job?.id} failed: ${err.message}`);
  // after the last attempt, unlock the submission so the student can resubmit
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await Submission.findByIdAndUpdate(job.data.submissionId, {
      $set: { status: job.data.prevStatus || "pending" },
    });
  }
});

gradingWorker.on("error", (err) =>
  console.error("❌ [Worker] error:", err.message),
);
