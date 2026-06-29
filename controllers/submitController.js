// import Submission from "../models/Submission.js";
// import Assignment from "../models/Assignment.js";
// import { evaluateWithGemini } from "../services/geminiService.js";
// import { gradingQueue } from "../utils/gradingQueue.js";

// // 1. EXECUTE AI EVALUATION ENGINE WITH FIFO CONCURRENCY BALANCING
// export const submitAssignment = async (req, res) => {
//   const { submissionId, responseText, tabSwitchCount } = req.body;

//   try {
//     const submission =
//       await Submission.findById(submissionId).populate("assignmentId");
//     if (!submission) {
//       return res
//         .status(404)
//         .json({ message: "Target submission record not located." });
//     }

//     const assignment = submission.assignmentId;
//     const criteriaMap = Object.fromEntries(assignment.evaluationCriteria);

//     // Guardrail 1: Enforce deadline check
//     if (new Date() > new Date(assignment.dueDate)) {
//       return res.status(403).json({
//         message:
//           "The evaluation cut-off timeline has passed. Submission rejected.",
//       });
//     }

//     // Guardrail 2: Enforce Attempt Rules (Exam Mode vs Practice Mode)
//     if (
//       submission.status === "submitted" &&
//       !assignment.allowMultipleSubmissions
//     ) {
//       return res.status(400).json({
//         message:
//           "Assignment has already been completed and locked for this student.",
//       });
//     }

//     // 🔒 Guardrail 3: Text-Only Input Validation Check
//     if (
//       assignment.modality === "Text-Only" &&
//       (!responseText || responseText.trim() === "")
//     ) {
//       return res.status(400).json({
//         message:
//           "Validation Error: Submission response body text cannot be empty.",
//       });
//     }

//     // Guardrail 4: Speech-Only Input File Check
//     if (assignment.modality === "Speech-Only" && !req.file) {
//       return res.status(400).json({
//         message: "Validation Error: This turn-based route requires an audio file buffer stream.",
//       });
//     }

//     let evaluationResult;

//     // 🚀 ENQUEUE THE AI EVALUATION PROCESS TASK
//     try {
//       evaluationResult = await gradingQueue.enqueue(async () => {
//         // MODE A: TEXT-ONLY EVALUATION FLOW
//         if (assignment.modality === "Text-Only") {
//           submission.responseText = responseText;
//           return await evaluateWithGemini(
//             submission.assignedQuestion, // ◄── FIXED: Now accurately passes the student's randomized locked question
//             responseText,
//             criteriaMap,
//             assignment.aiNotes,
//           );
//         }
//         // MODE B: SPEECH-ONLY MULTI-MODAL AUDIO FLOW
//         else if (assignment.modality === "Speech-Only" && req.file) {
//           return await evaluateWithGemini(
//             submission.assignedQuestion,
//             req.file,
//             criteriaMap,
//             assignment.aiNotes,
//           );
//         } else {
//           throw new Error(
//             "Missing text submission payload or file stream data context.",
//           );
//         }
//       });

//       console.log("🤖 RAW GEMINI SERVICE RESPONSE OUTFLOW:", evaluationResult);
//     } catch (queueError) {
//       return res.status(503).json({
//         message:
//           "The AI evaluation terminal is currently heavily congested. Please try again in a moment.",
//         error: queueError.message,
//       });
//     }

//     // Process transcription text assignment safely for speech mode
//     if (assignment.modality === "Speech-Only") {
//       submission.responseText =
//         evaluationResult.transcript || "Audio Content Processed.";
//     }

//     // Bind structured evaluation payloads back to our database document parameters
//     submission.aiEvaluation = {
//       scores: evaluationResult.scores,
//       totalScoreGivenByAI: evaluationResult.totalScoreGivenByAI,
//       feedback: evaluationResult.feedback,
//     };

//     // Lock metrics parameters and log status complete tags
//     submission.tabSwitchCount = parseInt(tabSwitchCount) || 0;
//     submission.finalScoreOverride = null;
//     submission.status = "submitted";
//     submission.submittedAt = new Date();

//     await submission.save();

//     res.status(200).json({
//       message: "Submission successfully evaluated and logged.",
//       submission,
//     });
//   } catch (error) {
//     console.error("❌ Evaluation Controller Runtime Crash:", error);
//     res.status(500).json({
//       message: "AI Processing execution module dropped.",
//       error: error.message,
//     });
//   }
// };

// // 2. FETCH GRADES FOR INSTRUCTOR PANELS
// export const getAssignmentSubmissions = async (req, res) => {
//   try {
//     const submissions = await Submission.find({
//       assignmentId: req.params.assignmentId,
//     })
//       .populate("studentId", "name email")
//       .sort({ submittedAt: -1 });
//     res.status(200).json(submissions);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // 3. MANUAL INSTRUCTOR MARK OVERRIDES
// export const overrideSubmissionScore = async (req, res) => {
//   const { finalScoreOverride } = req.body;
//   try {
//     const submission = await Submission.findByIdAndUpdate(
//       req.params.id,
//       { $set: { finalScoreOverride } },
//       { new: true },
//     );
//     res.status(200).json({
//       message: "Teacher score override updated successfully.",
//       submission,
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

import Submission from "../models/Submission.js";
import Assignment from "../models/Assignment.js";
import {
  evaluateWithGemini,
  evaluateConversationTurn,
} from "../services/geminiService.js";
import { gradingQueue } from "../utils/gradingQueue.js";

// 1. EXECUTE AI EVALUATION ENGINE (HANDLES BOTH STATIC TEXT & DYNAMIC CONVERSATIONAL SPEECH)
export const submitAssignment = async (req, res) => {
  const { submissionId, responseText, tabSwitchCount } = req.body;

  try {
    const submission =
      await Submission.findById(submissionId).populate("assignmentId");
    if (!submission) {
      return res
        .status(404)
        .json({ message: "Target submission record not located." });
    }

    const assignment = submission.assignmentId;
    let criteriaMap = Object.fromEntries(assignment.evaluationCriteria || []);

    if (Object.keys(criteriaMap).length === 0) {
      criteriaMap = {
        "Overall Performance": assignment.totalMarks || 20, // Defaults to total marks if available
      };
    }

    // Guardrail 1: Enforce deadline check
    if (new Date() > new Date(assignment.dueDate)) {
      return res.status(403).json({
        message:
          "The evaluation cut-off timeline has passed. Submission rejected.",
      });
    }

    // Guardrail 2: Enforce Attempt Rules for completed sessions (Only blocks text-only or finished interviews)
    if (
      submission.status === "submitted" &&
      !assignment.allowMultipleSubmissions
    ) {
      return res.status(400).json({
        message:
          "Assignment has already been completed and locked for this student.",
      });
    }

    // Guardrail 3: Text-Only Input Validation Check
    if (
      assignment.modality === "Text-Only" &&
      (!responseText || responseText.trim() === "")
    ) {
      return res.status(400).json({
        message:
          "Validation Error: Submission response body text cannot be empty.",
      });
    }

    // Guardrail 4: Speech-Only Input File Check
    if (assignment.modality === "Speech-Only" && !req.file) {
      return res.status(400).json({
        message:
          "Validation Error: This turn-based route requires an audio file buffer stream.",
      });
    }

    let result;

    // 🚀 ENQUEUE THE RELEVANT AI EVALUATION PIPELINE
    try {
      result = await gradingQueue.enqueue(async () => {
        // 📝 MODE A: TEXT-ONLY STATIC EVALUATION FLOW
        if (assignment.modality === "Text-Only") {
          submission.responseText = responseText;
          return await evaluateWithGemini(
            submission.assignedQuestion,
            responseText,
            criteriaMap,
            assignment.aiNotes,
          );
        }

        // 🎙️ MODE B: SPEECH-ONLY DYNAMIC CONVERSATIONAL FLOW
        else if (assignment.modality === "Speech-Only") {
          return await evaluateConversationTurn({
            assignmentTitle: assignment.title,
            aiNotes: assignment.aiNotes,
            criteriaMap: criteriaMap,
            history: submission.conversationHistory || [],
            audioFile: req.file,
          });
        }
      });

      console.log("🤖 RAW GEMINI SERVICE RESPONSE OUTFLOW:", result);
    } catch (queueError) {
      return res.status(503).json({
        message:
          "The AI evaluation terminal is currently heavily congested. Please try again in a moment.",
        error: queueError.message,
      });
    }

    // 💾 POST-PROCESSING & STATE CALCULATIONS
    submission.tabSwitchCount =
      parseInt(tabSwitchCount) || submission.tabSwitchCount;

    if (assignment.modality === "Text-Only") {
      // Bind finalized metrics directly for Text submissions
      submission.aiEvaluation = {
        scores: result.scores,
        totalScoreGivenByAI: result.totalScoreGivenByAI,
        feedback: result.feedback,
      };
      submission.status = "submitted";
      submission.submittedAt = new Date();
      submission.finalScoreOverride = null;
    } else if (assignment.modality === "Speech-Only") {
      // Append what the student said from Gemini's raw audio decoding transcription
      submission.conversationHistory.push({
        role: "student",
        text: result.transcript,
      });

      // 🏁 Check if the AI has signaled the conversation loop is over based on teacher's rules
      if (result.nextQuestion === "CONVERSATION_COMPLETE") {
        submission.status = "submitted";
        submission.submittedAt = new Date();
        submission.finalScoreOverride = null;

        // Bind finalized master grading reports back to DB properties
        submission.aiEvaluation = {
          scores: result.finalScores || {},
          totalScoreGivenByAI: result.totalScoreGivenByAI || 0,
          feedback:
            result.finalFeedback ||
            "Interview simulation concluded successfully.",
        };
      } else {
        // Conversation is ongoing! Push the AI's follow-up question turn into the historical thread
        submission.conversationHistory.push({
          role: "interviewer",
          text: result.nextQuestion,
        });
        submission.status = "ongoing";
      }
    }

    await submission.save();

    // Respond back dynamically. For speech, React reads 'nextQuestionToSpeak' through Text-to-Speech!
    res.status(200).json({
      message: "Submission updated and processed successfully.",
      status: submission.status,
      transcriptReceived:
        assignment.modality === "Speech-Only" ? result.transcript : undefined,
      nextQuestionToSpeak:
        assignment.modality === "Speech-Only" ? result.nextQuestion : undefined,
      submission,
    });
  } catch (error) {
    console.error("❌ Evaluation Controller Runtime Crash:", error);
    res.status(500).json({
      message: "AI Processing execution module dropped.",
      error: error.message,
    });
  }
};

// 2. FETCH GRADES FOR INSTRUCTOR PANELS (SUPPORTING STRUCTURAL STATUS FILTERS)
export const getAssignmentSubmissions = async (req, res) => {
  const { assignmentId } = req.params;
  const { status } = req.query; // Captures optional ?status=submitted or ?status=pending filters

  try {
    let queryFilter = { assignmentId };
    if (status) {
      queryFilter.status = status;
    }

    const submissions = await Submission.find(queryFilter)
      .populate("studentId", "name email")
      .sort({ submittedAt: -1 });

    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. MANUAL INSTRUCTOR MARK OVERRIDES
export const overrideSubmissionScore = async (req, res) => {
  const { finalScoreOverride } = req.body;
  try {
    const submission = await Submission.findByIdAndUpdate(
      req.params.id,
      { $set: { finalScoreOverride } },
      { new: true },
    );
    res.status(200).json({
      message: "Teacher score override updated successfully.",
      submission,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
