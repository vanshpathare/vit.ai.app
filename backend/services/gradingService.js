import { evaluateWithRouter, evaluateConversationTurn } from "./aiRouter.js";
import { toCriteriaMap } from "../utils/criteriaUtils.js";
import { calculateTextSimilarity } from "../utils/textSimilarityUtils.js";
import Submission from "../models/Submission.js";
import Assignment from "../models/Assignment.js";

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
    let gradingResult;

    if (assignment.modality === "Speech-Only") {
      gradingResult = await evaluateConversationTurn({
        assignmentTitle: assignment.title,
        aiNotes: assignment.aiNotes,
        speechQuestionCount: assignment.speechQuestionCount,
        criteriaMap,
        history: submission.conversationHistory || [],
        audioFile,
        preferredModel,
      });
    } else {
      gradingResult = await evaluateWithRouter({
        question: submission.assignedQuestions?.length
          ? submission.assignedQuestions
          : assignment.questionPool,
        responseInput: responses,
        criteriaMap,
        aiNotes: assignment.aiNotes,
        modality: assignment.modality,
        preferredModel,
      });
    }

    // 🟢 Text-Only Plagiarism Check (Executed inside the grading runner)
    if (
      assignment.modality === "Text-Only" &&
      assignment.enableTextPlagiarism &&
      assignment.assignmentCode
    ) {
      try {
        const matchingAssignments = await Assignment.find({
          assignmentCode: assignment.assignmentCode,
        }).select("_id");
        const targetAssignmentIds = matchingAssignments.map((a) => a._id);

        const existingSubmissions = await Submission.find({
          assignmentId: { $in: targetAssignmentIds },
          _id: { $ne: submission._id },
        });

        const studentText = (responses || [])
          .map((r) => r.answerText || "")
          .join(" ");
        const thresholdPercentage =
          assignment.uploadConfig?.similarityThreshold ?? 85;
        const similarityThresholdRatio = thresholdPercentage / 100;

        let textPlagiarismDetected = false;
        let matchedClusterId = null;

        if (studentText.trim().length > 15) {
          for (const sub of existingSubmissions) {
            const peerText = (sub.responses || [])
              .map((r) => r.answerText || "")
              .join(" ");
            const similarityScore = calculateTextSimilarity(
              studentText,
              peerText,
            );

            if (similarityScore >= similarityThresholdRatio) {
              textPlagiarismDetected = true;
              matchedClusterId = sub.plagiarismClusterId || sub._id;
              break;
            }
          }
        }

        submission.isTextPlagiarism = textPlagiarismDetected;
        if (textPlagiarismDetected) {
          submission.plagiarismClusterId = matchedClusterId;
          await Submission.findByIdAndUpdate(matchedClusterId, {
            isTextPlagiarism: true,
            plagiarismClusterId: matchedClusterId,
          });
        } else {
          submission.plagiarismClusterId = null;
        }
      } catch (plagErr) {
        console.warn("⚠️ Text plagiarism check warning:", plagErr.message);
      }
    }

    // Inside gradingService.js where text plagiarism runs:

    return gradingResult;
  };

  return await localFallback.enqueue(() => runAiEvaluation());
}
