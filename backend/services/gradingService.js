import { evaluateWithRouter, evaluateConversationTurn } from "./aiRouter.js";
import { toCriteriaMap } from "../utils/criteriaUtils.js";

class LocalFallbackQueue {
  constructor(maxConcurrency = 2, maxRpm = 15) {
    this.queue = [];
    this.activeCount = 0;
    this.maxConcurrency = maxConcurrency;
    this.maxRpm = maxRpm;
    this.timeWindow = 60000;
    this.requestTimestamps = [];
  }

  enqueue(taskFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFunction, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0)
      return;

    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < this.timeWindow,
    );

    if (this.requestTimestamps.length >= this.maxRpm) {
      const waitTime =
        this.timeWindow - (now - this.requestTimestamps[0]) + 200;
      console.warn(
        `⏳ [Local Queue] RPM ceiling hit. Pausing for ${Math.ceil(waitTime / 1000)}s...`,
      );
      setTimeout(() => this.processNext(), waitTime);
      return;
    }

    this.requestTimestamps.push(Date.now());
    this.activeCount++;
    const { taskFunction, resolve, reject } = this.queue.shift();

    try {
      resolve(await taskFunction());
    } catch (error) {
      reject(error);
    } finally {
      this.activeCount--;
      setTimeout(() => this.processNext(), 1000);
    }
  }
}

const localFallback = new LocalFallbackQueue();

export async function processAiGrading({
  assignment,
  submission,
  responses,
  audioFile,
  preferredModel,
}) {
  const criteriaMap = toCriteriaMap(assignment);

  const runAiEvaluation = async () => {
    if (assignment.modality === "Speech-Only") {
      return await evaluateConversationTurn({
        assignmentTitle: assignment.title,
        aiNotes: assignment.aiNotes,
        speechQuestionCount: assignment.speechQuestionCount,
        criteriaMap,
        history: submission.conversationHistory || [],
        audioFile,
        preferredModel,
      });
    }
    return await evaluateWithRouter({
      question: submission.assignedQuestions?.length
        ? submission.assignedQuestions
        : assignment.questionPool,
      responseInput: responses,
      criteriaMap,
      aiNotes: assignment.aiNotes,
      modality: assignment.modality,
      preferredModel,
    });
  };

  return await localFallback.enqueue(() => runAiEvaluation());
}
