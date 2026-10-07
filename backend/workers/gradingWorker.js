// workers/gradingWorker.js
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
    const sub = await Submission.findById(submissionId).select(
      "assignedQuestions status",
    );

    // teacher already graded this manually while it waited -> nothing to do
    if (!sub || sub.status !== "queued") {
      console.log(`⏭️ [Worker] Skipping ${submissionId}: no longer queued`);
      return;
    }

    const questions = sub.assignedQuestions?.length
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

    if (
      !result ||
      !result.scores ||
      typeof result.totalScoreGivenByAI !== "number"
    ) {
      throw new Error("AI returned an incomplete evaluation");
    }

    // Conditional save: only if the submission is STILL queued, so a manual
    // grade from the teacher can never be overwritten by a late AI result.
    const saved = await Submission.findOneAndUpdate(
      { _id: submissionId, status: "queued" },
      {
        $set: {
          aiEvaluation: {
            scores: result.scores,
            totalScoreGivenByAI: result.totalScoreGivenByAI,
            feedback: result.feedback,
          },
          status: "submitted",
          submittedAt: new Date(),
        },
        $unset: { gradingError: "" },
      },
    );

    if (saved) {
      console.log(`✅ [Worker] Saved grade for submission ${submissionId}`);
    } else {
      console.log(
        `⏭️ [Worker] ${submissionId} was graded manually; AI result discarded`,
      );
    }
  },
  {
    connection: bullConnection,
    concurrency: 2,
    // ~9 jobs/min keeps one model under its 8,000 tokens-per-minute cap
    limiter: { max: 9, duration: 60000 },
  },
);

// Runs after EVERY failed attempt. The student's answers stay saved and the
// submission stays in the Queue; the teacher sees the exact error.
gradingWorker.on("failed", async (job, err) => {
  console.error(`❌ [Worker] Job ${job?.id} failed: ${err.message}`);
  if (!job) return;

  const attempts = job.attemptsMade;
  const final = attempts >= (job.opts.attempts ?? 1);

  try {
    await Submission.updateOne(
      { _id: job.data.submissionId, status: "queued" },
      {
        $set: {
          gradingError: {
            message: String(err.message).slice(0, 1500),
            at: new Date(),
            attempts,
            final,
          },
        },
      },
    );
  } catch (dbErr) {
    console.error("❌ [Worker] Could not record grading error:", dbErr.message);
  }
});

gradingWorker.on("error", (err) =>
  console.error("❌ [Worker] error:", err.message),
);
