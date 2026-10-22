import { Worker } from "bullmq";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Submission from "../models/Submission.js";
import Assignment from "../models/Assignment.js";
import { getCachedAssignment } from "../utils/cacheUtils.js";
import { evaluateUploadWithRouter } from "../services/uploadAiRouter.js";
import { calculateTextSimilarity } from "../utils/textSimilarityUtils.js";

dotenv.config();
connectDB(); // Ensure DB connection inside worker thread

const connection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : { host: "localhost", port: 6379 };

const uploadWorker = new Worker(
  "upload-grading-queue",
  async (job) => {
    const { assignmentId } = job.data;
    console.log(
      `🚀 [Upload Worker] Starting background grading batch for assignment: ${assignmentId}`,
    );

    const TIMEOUT_MS = 300_000; // 5 minutes
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            "AI evaluation process stalled. Timeout exceeded (5 minutes).",
          ),
        );
      }, TIMEOUT_MS);
    });

    // 🟢 Core batch grading execution task
    const gradingTask = async () => {
      const assignment = await getCachedAssignment(assignmentId);
      if (!assignment) {
        throw new Error("Assignment not found in cache/DB.");
      }

      const queuedSubmissions = await Submission.find({
        assignmentId,
        status: "queued",
      }).populate("studentId", "name");

      if (queuedSubmissions.length === 0) {
        console.log(
          `ℹ️ [Upload Worker] No queued submissions found for assignment: ${assignmentId}`,
        );
        return { evaluatedCount: 0 };
      }

      // Cross-division assignment lookup for plagiarism clustering
      let targetAssignmentIds = [assignment._id];
      if (assignment.assignmentCode) {
        const matchingAssignments = await Assignment.find({
          assignmentCode: assignment.assignmentCode,
        }).select("_id");
        targetAssignmentIds = matchingAssignments.map((a) => a._id);
      }

      const manualQuestions = assignment.questionPool?.join("\n") || "";
      const manualInstructions = assignment.instructions || "";
      const targetQuestion = `
        Assignment Title: ${assignment.title || "Assignment"}
        Teacher's Instructions: ${manualInstructions}
        Specific Questions to Answer:
        ${manualQuestions}
        `.trim();

      let criteriaMapObj = {};
      if (assignment.evaluationCriteria) {
        if (assignment.evaluationCriteria instanceof Map) {
          for (let [key, val] of assignment.evaluationCriteria.entries()) {
            criteriaMapObj[key] = val;
          }
        } else if (typeof assignment.evaluationCriteria === "object") {
          criteriaMapObj = assignment.evaluationCriteria;
        }
      }

      const thresholdPercentage =
        assignment.uploadConfig?.similarityThreshold ?? 85;
      const similarityThresholdRatio = thresholdPercentage / 100;
      let evaluatedCount = 0;

      for (const submission of queuedSubmissions) {
        try {
          const filesForEvaluation = [];

          // 1. Fetch student files from R2
          for (const file of submission.uploadedFiles || []) {
            if (file.fileUrl) {
              const fetchRes = await fetch(file.fileUrl);
              if (fetchRes.ok) {
                const buffer = Buffer.from(await fetchRes.arrayBuffer());
                filesForEvaluation.push({
                  originalname: file.fileName || "uploaded_page.jpg",
                  mimetype:
                    file.fileType === "pdf" ? "application/pdf" : "image/jpeg",
                  buffer: buffer,
                });
              }
            }
          }

          // 🟢 CRITICAL GUARD: If student uploaded NO files, force 0 marks immediately without calling AI!
          if (!filesForEvaluation || filesForEvaluation.length === 0) {
            const zeroScores = {};
            for (const key of Object.keys(criteriaMapObj)) {
              zeroScores[key] = 0;
            }

            submission.extractedText = "";
            submission.aiEvaluation = {
              scores: zeroScores,
              totalScoreGivenByAI: 0,
              feedback:
                "🚨 [Validation Error]: No files found in submission record. Score forced to 0.",
            };
            submission.status = "submitted";
            await submission.save();
            evaluatedCount++;
            continue; // Skip the rest of the AI and plagiarism checks for this empty submission!
          }

          // 2. Fetch teacher reference attachments
          if (assignment.attachments && assignment.attachments.length > 0) {
            for (const att of assignment.attachments) {
              if (att.url) {
                const attRes = await fetch(att.url);
                if (attRes.ok) {
                  const attBuffer = Buffer.from(await attRes.arrayBuffer());
                  filesForEvaluation.push({
                    originalname:
                      att.fileName || att.title || "teacher_reference.docx",
                    mimetype:
                      att.fileType === "pdf"
                        ? "application/pdf"
                        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    buffer: attBuffer,
                  });
                }
              }
            }
          }

          // 3. Run AI Router
          const aiResult = await evaluateUploadWithRouter({
            question: targetQuestion,
            files: filesForEvaluation,
            criteriaMap: criteriaMapObj,
            aiNotes: assignment.aiNotes,
            studentRosterName: submission.studentId?.name || "",
          });

          // 🟢 4. SAVE EXACT TRANSCRIBED TEXT TO DATABASE FIRST
          submission.extractedText = aiResult.transcribedText || "";
          submission.aiEvaluation = {
            scores: aiResult.scores || {},
            totalScoreGivenByAI: aiResult.totalScoreGivenByAI || 0,
            feedback: `${aiResult.isScreenCapture ? "🚨 [Flagged: Screen Capture Photo] " : ""}${aiResult.isSyntheticHandwriting ? "🚨 [Flagged: Text-to-Handwriting Tool / Printout] " : ""}${aiResult.feedback || ""}`,
          };
          submission.status = "submitted";
          await submission.save();

          // 5. CROSS-DIVISION TEXT PLAGIARISM CHECK
          const existingSubmissions = await Submission.find({
            assignmentId: { $in: targetAssignmentIds },
            _id: { $ne: submission._id },
          });

          let textPlagiarismDetected = false;
          let textMatchedStudentId = null;
          let matchedClusterId = null;
          const studentRawText = submission.extractedText;

          if (studentRawText && studentRawText.trim().length > 15) {
            for (const sub of existingSubmissions) {
              const peerRawText = sub.extractedText || "";
              if (!peerRawText || peerRawText.trim().length <= 15) continue;

              const similarityScore = calculateTextSimilarity(
                studentRawText,
                peerRawText,
              );

              if (similarityScore >= similarityThresholdRatio) {
                textPlagiarismDetected = true;
                textMatchedStudentId = sub.studentId;
                matchedClusterId = sub.plagiarismClusterId || sub._id;
                break;
              }
            }
          }

          submission.isTextPlagiarism = textPlagiarismDetected;

          if (textPlagiarismDetected) {
            submission.plagiarismClusterId = matchedClusterId;
            submission.plagiarismDetails =
              `Exact text match with student ID: ${textMatchedStudentId}`.trim();

            await Submission.findByIdAndUpdate(matchedClusterId, {
              isTextPlagiarism: true,
              plagiarismClusterId: matchedClusterId,
            });
            await submission.save();
          } else {
            submission.plagiarismClusterId = null;
            await submission.save();
          }

          evaluatedCount++;
        } catch (err) {
          console.error(
            `❌ [Upload Worker] Error grading submission ${submission._id}:`,
            err.message,
          );

          // 🟢 STRICT FORENSIC & FRAUD CHECK: Ensure keywords match frontend tab filters exactly
          if (
            err.isValidation ||
            err.fraudType ||
            err.message.includes("Fraud Detected")
          ) {
            let cleanFraudMessage = err.message;

            // Ensure explicit keyword matching for frontend tab filters
            if (
              cleanFraudMessage.includes("Synthetic Handwriting") &&
              !cleanFraudMessage.includes("Text-to-Handwriting")
            ) {
              cleanFraudMessage =
                "🚨 [Flagged: Text-to-Handwriting Tool / Printout] " +
                cleanFraudMessage;
            }
            if (
              cleanFraudMessage.includes("Screen Capture") &&
              !cleanFraudMessage.includes("Screen Capture")
            ) {
              cleanFraudMessage =
                "🚨 [Flagged: Screen Capture Photo] " + cleanFraudMessage;
            }

            submission.aiEvaluation = {
              scores: {},
              totalScoreGivenByAI: 0,
              feedback: cleanFraudMessage,
            };
            submission.status = "submitted";
            await submission.save();
            evaluatedCount++;
          } else {
            // 🟢 BULLETPROOF SANITIZATION: Never save raw 429 JSON/error logs to student feedback
            submission.aiEvaluation = {
              scores: {},
              totalScoreGivenByAI: 0,
              feedback:
                "Submission received successfully! Your work is securely queued for instructor review.",
            };
            submission.status = "queued"; // Stays in queue so teacher can re-evaluate later
            await submission.save();
          }
        }
      }

      console.log(
        `✅ [Upload Worker] Finished batch. Evaluated ${evaluatedCount} submissions.`,
      );
      return { evaluatedCount };
    };

    // 🟢 Race grading task against 5-min timeout with safe catch block to prevent server crashes
    try {
      const result = await Promise.race([gradingTask(), timeoutPromise]);
      clearTimeout(timeoutHandle);
      return result;
    } catch (err) {
      clearTimeout(timeoutHandle);
      console.warn(`⚠️ [Upload Worker] Batch interrupted: ${err.message}`);

      if (
        err.message.includes("Timeout exceeded") ||
        err.message.includes("stalled")
      ) {
        await Submission.updateMany(
          { assignmentId, status: "queued" },
          {
            $set: {
              aiEvaluation: {
                scores: {},
                totalScoreGivenByAI: 0,
                feedback:
                  "Submission received successfully! The AI evaluation service is currently experiencing high demand. Please try again after some time.",
              },
            },
          },
        );
        return { evaluatedCount: 0, error: "Timeout exceeded" };
      }

      throw err;
    }
  },
  {
    connection,
    lockDuration: 120_000, // Extends lock time to 2 minutes to prevent job stalling
    lockRenewTime: 60_000,
  },
);

uploadWorker.on("completed", (job) => {
  console.log(`🎉 [Upload Worker] Job ${job.id} completed successfully.`);
});

uploadWorker.on("failed", async (job, err) => {
  console.error(`❌ [Upload Worker] Job ${job.id} failed:`, err.message);

  // 🟢 If the job failed due to our 5-minute timeout, update queued submissions with the try-later message
  if (
    err.message.includes("Timeout exceeded") ||
    err.message.includes("stalled")
  ) {
    const { assignmentId } = job.data || {};
    if (assignmentId) {
      await Submission.updateMany(
        { assignmentId, status: "queued" },
        {
          $set: {
            aiEvaluation: {
              scores: {},
              totalScoreGivenByAI: 0,
              feedback:
                "Submission received successfully! The AI evaluation service is currently experiencing high demand. Please try again after some time.",
            },
          },
        },
      );
      console.log(
        `⏱️ [Upload Worker] Gracefully terminated stalled batch for assignment ${assignmentId} due to timeout.`,
      );
    }
  }
});
