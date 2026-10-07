// utils/enqueueGrading.js
import { gradingQueue } from "./gradingQueue.js";
import { toCriteriaMap } from "./criteriaUtils.js";

// One job per submission. Same id every time, so a student double-click,
// a teacher "Evaluate" click and a retry can never grade the same answer twice.
export const gradingJobId = (submissionId) => `grade-${submissionId}`;

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);

/**
 * Adds a fresh grading job for a submission.
 * - If an old job (failed / waiting / retrying) exists, it is removed first so the new one really runs.
 * - If a job is being graded RIGHT NOW, nothing is added and { alreadyRunning: true } is returned.
 */
export async function enqueueGrading({
  submissionId,
  assignment,
  responses,
  preferredModel,
}) {
  const jobId = gradingJobId(submissionId);

  return withTimeout(
    (async () => {
      const existing = await gradingQueue.getJob(jobId);
      if (existing) {
        if ((await existing.getState()) === "active") {
          return { alreadyRunning: true };
        }
        await existing.remove();
      }

      await gradingQueue.add(
        "evaluate-assignment",
        {
          submissionId: String(submissionId),
          assignment,
          responses: (responses || []).map((r) => ({
            questionText: r.questionText,
            answerText: r.answerText,
          })),
          criteriaMap: toCriteriaMap(assignment),
          preferredModel,
        },
        { jobId },
      );
      return { queued: true };
    })(),
    8000,
    "Queue",
  );
}

/**
 * Removes a waiting/retrying job (used when a teacher grades manually).
 * A job that is being graded this second is left alone; the worker's
 * conditional save protects the manual marks in that case.
 */
export async function removeGradingJob(submissionId) {
  try {
    const job = await gradingQueue.getJob(gradingJobId(submissionId));
    if (job && (await job.getState()) !== "active") {
      await job.remove();
    }
  } catch (err) {
    console.warn(`⚠️ Could not remove grading job: ${err.message}`);
  }
}
