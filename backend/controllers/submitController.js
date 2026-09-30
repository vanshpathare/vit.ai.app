//submitController.js
import Submission from "../models/Submission.js";
import { getCachedAssignment } from "../utils/cacheUtils.js";
import { processAiGrading } from "../services/gradingService.js"; // 👈 Import the fail-safe grading service wrapper

// 1. EXECUTE AI EVALUATION ENGINE (HANDLES BOTH STATIC TEXT & DYNAMIC CONVERSATIONAL SPEECH)
export const submitAssignment = async (req, res) => {
  console.log("🔍 Incoming req.body:", req.body);
  console.log("🔍 Incoming req.file:", req.file);
  const { submissionId, responses, tabSwitchCount, preferredModel } = req.body;

  try {
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res
        .status(404)
        .json({ message: "Target submission record not located." });
    }

    const assignment = await getCachedAssignment(submission.assignmentId);
    if (!assignment) {
      return res
        .status(404)
        .json({ message: "Assignment profile context not found." });
    }

    // Guardrail 1: Enforce deadline check
    if (new Date() > new Date(assignment.dueDate)) {
      return res.status(403).json({
        message: "The evaluation due date has passed. Submission rejected.",
      });
    }

    // Guardrail 2: Enforce Attempt Rules for completed sessions
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
      (!responses || !Array.isArray(responses) || responses.length === 0)
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

    // 🚀 EXECUTE UNIVERSAL AI GRADING (BullMQ with automatic Redis failover fallback)
    try {
      result = await processAiGrading({
        assignment,
        submission,
        responses,
        audioFile: req.file,
        preferredModel,
      });

      console.log("🤖 RAW AI SERVICE RESPONSE OUTFLOW:", result);
    } catch (gradingError) {
      return res.status(503).json({
        message:
          "The AI evaluation service is currently heavily congested or unavailable. Please try again in a moment.",
        error: gradingError.message,
      });
    }

    // 💾 POST-PROCESSING & STATE CALCULATIONS
    submission.tabSwitchCount =
      parseInt(tabSwitchCount) || submission.tabSwitchCount;

    if (assignment.modality === "Text-Only") {
      submission.responses = responses; // Save responses for text assignments
      submission.aiEvaluation = {
        scores: result.scores,
        totalScoreGivenByAI: result.totalScoreGivenByAI,
        feedback: result.feedback,
      };
      submission.status = "submitted";
      submission.submittedAt = new Date();
      submission.finalScoreOverride = null;
    } else if (assignment.modality === "Speech-Only") {
      submission.conversationHistory.push({
        role: "student",
        text: result.transcript,
      });

      if (result.nextQuestion === "CONVERSATION_COMPLETE") {
        submission.status = "submitted";
        submission.submittedAt = new Date();
        submission.finalScoreOverride = null;

        submission.aiEvaluation = {
          scores: result.finalScores || {},
          totalScoreGivenByAI: result.totalScoreGivenByAI || 0,
          feedback:
            result.finalFeedback ||
            "Interview simulation concluded successfully.",
        };
      } else {
        submission.conversationHistory.push({
          role: "interviewer",
          text: result.nextQuestion,
        });
        submission.status = "ongoing";
      }
    }

    await submission.save();

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

// 2. FETCH GRADES FOR INSTRUCTOR PANELS
export const getAssignmentSubmissions = async (req, res) => {
  const { assignmentId } = req.params;
  const { status } = req.query;

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

// 4. FETCH FULL SUBMISSION DETAIL
export const getStudentSubmissionDetails = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate({
        path: "assignmentId",
        select:
          "title modality totalMarks dueDate questionPool aiNotes instructions isResultPublished classId evaluationCriteria allowMultipleSubmissions attachments",
        populate: {
          path: "classId",
          select: "name",
        },
      })
      .populate("studentId", "name email");

    if (!submission) {
      return res
        .status(404)
        .json({ message: "Submission workspace not found." });
    }

    const assignment = await getCachedAssignment(submission.assignmentId);

    const isOwner =
      submission.studentId._id.toString() === req.user._id.toString();
    const isTeacher = req.user.role === "teacher";

    if (!isOwner && !isTeacher) {
      return res
        .status(403)
        .json({ message: "Access Denied: Workspace ownership mismatch." });
    }

    let sanitizedSubmission = submission.toObject();
    sanitizedSubmission.assignmentId = assignment;

    if (isTeacher) {
      return res.status(200).json(sanitizedSubmission);
    }

    if (
      sanitizedSubmission.finalScoreOverride !== null &&
      sanitizedSubmission.finalScoreOverride !== undefined
    ) {
      if (sanitizedSubmission.aiEvaluation) {
        sanitizedSubmission.aiEvaluation.totalScoreGivenByAI =
          sanitizedSubmission.finalScoreOverride;
      }
      delete sanitizedSubmission.finalScoreOverride;
    }

    if (assignment && assignment.isResultPublished === false) {
      if (sanitizedSubmission.aiEvaluation) {
        sanitizedSubmission.aiEvaluation.totalScoreGivenByAI = null;
        sanitizedSubmission.aiEvaluation.scores = null;
      }
      delete sanitizedSubmission.finalScoreOverride;
    }

    res.status(200).json(sanitizedSubmission);
  } catch (error) {
    res.status(500).json({
      message: "Error loading submission data context.",
      error: error.message,
    });
  }
};

// 🟢 TAMPER-PROOF REAL-TIME INFRACTION CONTROLLER
export const logSubmissionInfraction = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedSubmission = await Submission.findByIdAndUpdate(
      id,
      { $inc: { tabSwitchCount: 1 } },
      { new: true, runValidators: true },
    );

    if (!updatedSubmission) {
      return res
        .status(404)
        .json({ message: "Submission profile document context not found." });
    }

    console.log(
      `🔒 [Proctor Alert] Submission ${id} tabSwitchCount securely incremented to: ${updatedSubmission.tabSwitchCount}`,
    );

    return res.status(200).json({
      message: "Infraction successfully logged.",
      tabSwitchCount: updatedSubmission.tabSwitchCount,
    });
  } catch (error) {
    console.error("Error logging real-time proctor infraction:", error);
    return res.status(500).json({
      message: "Internal server registry logging failure.",
      error: error.message,
    });
  }
};
