// workers/gradingWorker.js
import "dotenv/config";
import { Worker } from "bullmq";
import Submission from "../models/Submission.js";
import Assignment from "../models/Assignment.js"; // 🟢 1. Import Assignment model
import { evaluateWithRouter } from "../services/aiRouter.js";
import { bullConnection } from "../config/bullConnection.js";
import { calculateTextSimilarity } from "../utils/textSimilarityUtils.js"; // 🟢 2. Import text similarity utility

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

    // 🟢 3. TEXT-ONLY PLAGIARISM CHECK & CLUSTER PROPAGATION
    if (assignment.assignmentCode) {
      try {
        const matchingAssignments = await Assignment.find({
          assignmentCode: assignment.assignmentCode,
        }).select("_id");
        const targetAssignmentIds = matchingAssignments.map((a) => a._id);

        const existingSubmissions = await Submission.find({
          assignmentId: { $in: targetAssignmentIds },
          _id: { $ne: submissionId },
        });

        const studentText = (responses || [])
          .map((r) => r.answerText || "")
          .join(" ");

        // 🟡 YOUR CONSOLE LOG HERE
        console.log(
          `🔍 [Text Plagiarism] Comparing student text: "${studentText.slice(0, 30)}..." against ${existingSubmissions.length} peers under code: ${assignment.assignmentCode}`,
        );

        const thresholdPercentage = assignment.similarityThreshold ?? 85;
        const similarityThresholdRatio = thresholdPercentage / 100;

        let textPlagiarismDetected = false;
        let matchedClusterId = null;

        if (studentText.trim().length > 15) {
          for (const peerSub of existingSubmissions) {
            const peerText = (peerSub.responses || [])
              .map((r) => r.answerText || "")
              .join(" ");
            const similarityScore = calculateTextSimilarity(
              studentText,
              peerText,
            );

            if (similarityScore >= similarityThresholdRatio) {
              textPlagiarismDetected = true;
              matchedClusterId = peerSub.plagiarismClusterId || peerSub._id;
              break;
            }
          }
        }

        if (textPlagiarismDetected) {
          await Submission.findByIdAndUpdate(submissionId, {
            isTextPlagiarism: true,
            plagiarismClusterId: matchedClusterId,
          });
          await Submission.findByIdAndUpdate(matchedClusterId, {
            isTextPlagiarism: true,
            plagiarismClusterId: matchedClusterId,
          });
        } else {
          await Submission.findByIdAndUpdate(submissionId, {
            isTextPlagiarism: false,
            plagiarismClusterId: null,
          });
        }
      } catch (plagErr) {
        console.warn("⚠️ Text plagiarism check warning:", plagErr.message);
      }
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
