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

// const uploadWorker = new Worker(
//   "upload-grading-queue",
//   async (job) => {
//     const { assignmentId } = job.data;
//     console.log(
//       `🚀 [Upload Worker] Starting background grading batch for assignment: ${assignmentId}`,
//     );

//     const assignment = await getCachedAssignment(assignmentId);
//     if (!assignment) {
//       throw new Error("Assignment not found in cache/DB.");
//     }

//     const queuedSubmissions = await Submission.find({
//       assignmentId,
//       status: "queued",
//     });

//     if (queuedSubmissions.length === 0) {
//       console.log(
//         `ℹ️ [Upload Worker] No queued submissions found for assignment: ${assignmentId}`,
//       );
//       return { evaluatedCount: 0 };
//     }

//     // Cross-division assignment lookup for plagiarism clustering
//     let targetAssignmentIds = [assignment._id];
//     if (assignment.assignmentCode) {
//       const matchingAssignments = await Assignment.find({
//         assignmentCode: assignment.assignmentCode,
//       }).select("_id");
//       targetAssignmentIds = matchingAssignments.map((a) => a._id);
//     }

//     const existingSubmissions = await Submission.find({
//       assignmentId: { $in: targetAssignmentIds },
//     });

//     // 🟢 CLEANED UP QUESTION POOL & INSTRUCTIONS FORMATTING
//     const manualQuestions = assignment.questionPool?.join("\n- ") || "";
//     const manualInstructions = assignment.instructions || "";
//     const targetQuestion = `
//     Assignment Title: ${assignment.title || "Assignment"}
//     Teacher's Instructions: ${manualInstructions}
//     Specific Questions to Answer:
//     - ${manualQuestions}
//     `.trim();

//     let criteriaMapObj = {};
//     if (assignment.evaluationCriteria) {
//       if (assignment.evaluationCriteria instanceof Map) {
//         for (let [key, val] of assignment.evaluationCriteria.entries()) {
//           criteriaMapObj[key] = val;
//         }
//       } else if (typeof assignment.evaluationCriteria === "object") {
//         criteriaMapObj = assignment.evaluationCriteria;
//       }
//     }

//     const thresholdPercentage =
//       assignment.uploadConfig?.similarityThreshold ?? 85;
//     const similarityThresholdRatio = thresholdPercentage / 100;
//     let evaluatedCount = 0;

//     for (const submission of queuedSubmissions) {
//       try {
//         const filesForEvaluation = [];

//         // 1. Fetch student files from R2
//         for (const file of submission.uploadedFiles || []) {
//           if (file.fileUrl) {
//             const fetchRes = await fetch(file.fileUrl);
//             if (fetchRes.ok) {
//               const buffer = Buffer.from(await fetchRes.arrayBuffer());
//               filesForEvaluation.push({
//                 originalname: file.fileName || "uploaded_page.jpg",
//                 mimetype:
//                   file.fileType === "pdf" ? "application/pdf" : "image/jpeg",
//                 buffer: buffer,
//               });
//             }
//           }
//         }

//         // 2. Fetch teacher reference attachments
//         if (assignment.attachments && assignment.attachments.length > 0) {
//           for (const att of assignment.attachments) {
//             if (att.url) {
//               const attRes = await fetch(att.url);
//               if (attRes.ok) {
//                 const attBuffer = Buffer.from(await attRes.arrayBuffer());
//                 filesForEvaluation.push({
//                   originalname:
//                     att.fileName || att.title || "teacher_reference.docx",
//                   mimetype:
//                     att.fileType === "pdf"
//                       ? "application/pdf"
//                       : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//                   buffer: attBuffer,
//                 });
//               }
//             }
//           }
//         }

//         // 3. Run AI Router
//         const aiResult = await evaluateUploadWithRouter({
//           question: targetQuestion,
//           files: filesForEvaluation,
//           criteriaMap: criteriaMapObj,
//           aiNotes: assignment.aiNotes,
//         });

//         // 🟢 4. SAVE EXACT TRANSCRIBED TEXT TO DATABASE
//         submission.extractedText = aiResult.transcribedText || "";

//         // 🟢 5. CROSS-DIVISION TEXT PLAGIARISM CHECK USING EXTRACTED TEXT
//         let textPlagiarismDetected = false;
//         let textMatchedStudentId = null;
//         let matchedClusterId = null;
//         const studentRawText = submission.extractedText;

//         if (studentRawText.trim().length > 15) {
//           for (const sub of existingSubmissions) {
//             if (sub._id.toString() === submission._id.toString()) continue;

//             // Compare against peer's exact extracted text
//             const peerRawText = sub.extractedText || "";
//             const similarityScore = calculateTextSimilarity(
//               studentRawText,
//               peerRawText,
//             );

//             if (similarityScore >= similarityThresholdRatio) {
//               textPlagiarismDetected = true;
//               textMatchedStudentId = sub.studentId;
//               matchedClusterId = sub.plagiarismClusterId || sub._id;
//               break;
//             }
//           }
//         }

//         submission.isTextPlagiarism = textPlagiarismDetected;

//         // 🟡 6. APPLY AND PROPAGATE SHARED CLUSTER ID TO BOTH STUDENTS
//         if (textPlagiarismDetected) {
//           submission.plagiarismClusterId = matchedClusterId;
//           submission.plagiarismDetails =
//             `Exact text match with student ID: ${textMatchedStudentId}`.trim();

//           // 🟡 Force the matched peer record to also sync with this exact cluster ID
//           await Submission.findByIdAndUpdate(matchedClusterId, {
//             isTextPlagiarism: true,
//             plagiarismClusterId: matchedClusterId,
//           });
//         } else {
//           submission.plagiarismClusterId = null; // 🟡 Prevent unmatched students from forming single-student clusters
//         }

//         submission.aiEvaluation = {
//           scores: aiResult.scores || {},
//           totalScoreGivenByAI: aiResult.totalScoreGivenByAI || 0,
//           feedback: `${aiResult.isScreenCapture ? "🚨 [Flagged: Screen Capture Photo] " : ""}${aiResult.isSyntheticHandwriting ? "🚨 [Flagged: Text-to-Handwriting Tool / Printout] " : ""}${aiResult.feedback || ""}`,
//         };

//         submission.status = "submitted";
//         await submission.save();
//         evaluatedCount++;
//       } catch (err) {
//         console.error(
//           `❌ [Upload Worker] Error grading submission ${submission._id}:`,
//           err.message,
//         );
//       }
//     }

//     console.log(
//       `✅ [Upload Worker] Finished batch. Evaluated ${evaluatedCount} submissions.`,
//     );
//     return { evaluatedCount };
//   },
//   { connection },
// );

// uploadWorker.on("completed", (job) => {
//   console.log(`🎉 [Upload Worker] Job ${job.id} completed successfully.`);
// });

// uploadWorker.on("failed", (job, err) => {
//   console.error(`❌ [Upload Worker] Job ${job.id} failed:`, err.message);
// });
// Inside uploadGradingWorker.js, replace the main worker function:

const uploadWorker = new Worker(
  "upload-grading-queue",
  async (job) => {
    const { assignmentId } = job.data;
    console.log(
      `🚀 [Upload Worker] Starting background grading batch for assignment: ${assignmentId}`,
    );

    const assignment = await getCachedAssignment(assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found in cache/DB.");
    }

    const queuedSubmissions = await Submission.find({
      assignmentId,
      status: "queued",
    });

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

    // 🟢 CLEANED UP QUESTION POOL & INSTRUCTIONS FORMATTING
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
        await submission.save(); // Saved to DB so peers can now read it!

        // 🟢 5. FRESH CROSS-DIVISION PEER FETCH (Ensures batch loop sees newly saved texts)
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

        // 🟢 6. APPLY AND PROPAGATE SHARED CLUSTER ID TO BOTH STUDENTS
        if (textPlagiarismDetected) {
          submission.plagiarismClusterId = matchedClusterId;
          submission.plagiarismDetails =
            `Exact text match with student ID: ${textMatchedStudentId}`.trim();

          await Submission.findByIdAndUpdate(matchedClusterId, {
            isTextPlagiarism: true,
            plagiarismClusterId: matchedClusterId,
          });
          await submission.save(); // Save cluster update
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
      }
    }

    console.log(
      `✅ [Upload Worker] Finished batch. Evaluated ${evaluatedCount} submissions.`,
    );
    return { evaluatedCount };
  },
  { connection },
);
