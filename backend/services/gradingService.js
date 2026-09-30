// services/gradingService.js
import { evaluateWithRouter, evaluateConversationTurn } from "./aiRouter.js";
import { gradingQueue } from "../utils/gradingQueue.js";

// 🛡️ EMERGENCY LOCAL FALLBACK QUEUE CLASS
// If Redis ever crashes, this local queue takes over to protect your 15 RPM limit in-memory!
class LocalFallbackQueue {
  constructor(maxConcurrency = 2, maxRpm = 15) {
    this.queue = [];
    this.activeCount = 0;
    this.maxConcurrency = maxConcurrency;
    this.maxRpm = maxRpm;
    this.timeWindow = 60000; // 1 minute
    this.requestTimestamps = [];
  }

  enqueue(taskFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFunction, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.timeWindow,
    );

    if (this.requestTimestamps.length >= this.maxRpm) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.timeWindow - (now - oldestTimestamp) + 200;
      console.warn(
        `⏳ [Local Fallback Guard] RPM ceiling hit. Pausing local queue for ${Math.ceil(waitTime / 1000)}s...`,
      );
      setTimeout(() => this.processNext(), waitTime);
      return;
    }

    this.requestTimestamps.push(Date.now());
    this.activeCount++;

    const { taskFunction, resolve, reject } = this.queue.shift();

    try {
      const result = await taskFunction();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeCount--;
      setTimeout(() => this.processNext(), 1000);
    }
  }
}

// Initialize a single global instance of the emergency local fallback queue
const localFallback = new LocalFallbackQueue();

/**
 * Universal AI grading wrapper with BullMQ primary and Local In-Memory Fallback secondary.
 */
export async function processAiGrading({
  assignment,
  submission,
  responses,
  audioFile,
  preferredModel,
}) {
  let criteriaMap = Object.fromEntries(assignment.evaluationCriteria || []);
  if (Object.keys(criteriaMap).length === 0) {
    criteriaMap = { "Overall Performance": assignment.totalMarks || 20 };
  }

  const gradingPayload = {
    assignment,
    submissionId: submission._id,
    responses,
    history: submission.conversationHistory,
    audioFile,
    modality: assignment.modality,
    criteriaMap,
    preferredModel,
  };

  // Helper function to execute the correct AI function based on modality
  const runAiEvaluation = async () => {
    if (assignment.modality === "Text-Only") {
      return await evaluateWithRouter({
        question: assignment.questionPool,
        responseInput: responses,
        criteriaMap,
        aiNotes: assignment.aiNotes,
        modality: "Text-Only",
        preferredModel,
      });
    } else if (assignment.modality === "Speech-Only") {
      return await evaluateConversationTurn({
        assignmentTitle: assignment.title,
        aiNotes: assignment.aiNotes,
        criteriaMap,
        questionPool: assignment.questionPool,
        totalQuestions: assignment.speechQuestionCount,
        history: submission.conversationHistory || [],
        audioFile,
        preferredModel,
      });
    } else {
      return await evaluateWithRouter({
        question: assignment.questionPool,
        responseInput: responses,
        criteriaMap,
        aiNotes: assignment.aiNotes,
        modality: assignment.modality,
        preferredModel,
      });
    }
  };

  try {
    // 1️⃣ ATTEMPT BULLMQ REDIS QUEUE FIRST (Primary Production Path)
    const job = await gradingQueue.add("evaluate-assignment", gradingPayload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });

    return await job.waitUntilFinished(gradingQueue.client);
  } catch (queueOrRedisError) {
    // 🛡️ 2️⃣ THE ULTIMATE BACKUP PLAN: Fall back to Local In-Memory Throttling Queue!
    console.warn(
      `⚠️ [Queue Warning] BullMQ/Redis failure (${queueOrRedisError.message}). Routing through Local In-Memory Throttling Queue.`,
    );

    // Even though Redis is down, this safely paces requests to protect your 15 RPM limit locally!
    return await localFallback.enqueue(() => runAiEvaluation());
  }
}
