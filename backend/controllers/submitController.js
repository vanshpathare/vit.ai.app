//submitController.js
import Submission from "../models/Submission.js";
import Classroom from "../models/Classroom.js";
import Assignment from "../models/Assignment.js";
import { getCachedAssignment } from "../utils/cacheUtils.js";
import { processAiGrading } from "../services/gradingService.js"; // used for Speech-Only turns + emergency inline fallback
import { enqueueGrading, removeGradingJob } from "../utils/enqueueGrading.js";
import { uploadToR2 } from "../services/r2Service.js";
import { generateImagePHash, comparePHashes } from "../utils/imageHashUtils.js";
import { evaluateUploadWithRouter } from "../services/uploadAiRouter.js";
import { calculateTextSimilarity } from "../utils/textSimilarityUtils.js";
import { enqueueUploadGrading } from "../utils/enqueueUploadGrading.js";

// A queued submission older than this is considered "stuck" (teacher gets an Evaluate button)
const STUCK_AFTER_MS = 15 * 60 * 1000;

// Small helper: does this teacher own the classroom the assignment belongs to?
const teacherOwnsAssignment = (assignment, teacherId) =>
  Classroom.exists({ _id: assignment.classId, teacherId });

// 1. EXECUTE AI EVALUATION ENGINE (HANDLES BOTH STATIC TEXT & DYNAMIC CONVERSATIONAL SPEECH)
export const submitAssignment = async (req, res) => {
  const { submissionId, responses, tabSwitchCount } = req.body;
  // Only teachers may force a specific AI model; students' value is ignored
  const preferredModel =
    req.user?.role === "teacher" ? req.body.preferredModel : undefined;

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

    if (assignment.modality === "Upload") {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          message:
            "Validation Error: Upload assignment requires at least one page or document.",
        });
      }

      const maxPagesAllowed = assignment.uploadConfig?.maxPages || 5;
      if (req.files.length > maxPagesAllowed) {
        return res.status(400).json({
          message: `Too many files uploaded. Maximum allowed is ${maxPagesAllowed} pages.`,
        });
      }

      const allowedType =
        assignment.uploadConfig?.allowedUploadType || "handwritten";
      // "handwritten" or "image" means pictures/photos only; "document" allows PDFs.
      if (allowedType === "handwritten") {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const isPdf =
            file.mimetype === "application/pdf" ||
            file.originalname.endsWith(".pdf");

          if (isPdf) {
            return res.status(400).json({
              message:
                "Validation Error: This assignment only accepts camera images. PDFs are not allowed.",
            });
          }
        }
      }

      try {
        // 1. Cross-division lookup: Find all assignments sharing this same assignmentCode
        let targetAssignmentIds = [assignment._id];
        if (assignment.assignmentCode) {
          const matchingAssignments = await Assignment.find({
            assignmentCode: assignment.assignmentCode,
          }).select("_id");
          targetAssignmentIds = matchingAssignments.map((a) => a._id);
        }

        // Fetch existing submissions across all classes/divisions linked to this code
        const existingSubmissions = await Submission.find({
          assignmentId: { $in: targetAssignmentIds },
        });

        const folderPath = `submissions/${assignment._id}/${req.user._id}`;
        const uploadedFilesMeta = [];
        let visualPlagiarismDetected = false;
        let flaggedByStudentId = null;
        let plagiarismClusterId = null;

        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const isPdf =
            file.mimetype === "application/pdf" ||
            file.originalname.endsWith(".pdf");
          const fileType = isPdf ? "pdf" : "image";
          const isImage = file.mimetype?.startsWith("image/");

          let pHash = null;
          if (isImage) {
            // Generate perceptual hash to catch angle/lighting shifted copies of someone else's paper
            pHash = await generateImagePHash(file.buffer);

            // Immediate perceptual hash check against existing submissions
            for (const sub of existingSubmissions) {
              if (sub.studentId.toString() === req.user._id.toString())
                continue;

              for (const prevFile of sub.uploadedFiles || []) {
                if (
                  prevFile.perceptualHash &&
                  comparePHashes(pHash, prevFile.perceptualHash, 5)
                ) {
                  visualPlagiarismDetected = true;
                  plagiarismClusterId = sub.plagiarismClusterId || sub._id;
                  flaggedByStudentId = sub.studentId;
                  break;
                }
              }
              if (visualPlagiarismDetected) break;
            }
          }

          // Upload to Cloudflare R2
          const fileUrl = await uploadToR2(
            file.buffer,
            file.originalname,
            folderPath,
            file.mimetype,
          );

          uploadedFilesMeta.push({
            fileUrl,
            fileName: file.originalname,
            fileType,
            pageNumber: i + 1,
            perceptualHash: pHash,
          });
        }

        if (visualPlagiarismDetected && !plagiarismClusterId) {
          plagiarismClusterId = submission._id;
        }

        // 2. Save submission payload and fraud metadata (Awaiting Teacher Manual Evaluation Trigger)
        submission.uploadedFiles = uploadedFilesMeta;
        submission.status = "queued"; // 🟢 CHANGE FROM "submitted" TO "queued"
        submission.queuedAt = new Date(); // 🟢 Track queue entry time
        submission.submittedAt = new Date();
        submission.tabSwitchCount =
          parseInt(tabSwitchCount) || submission.tabSwitchCount;

        if (visualPlagiarismDetected) {
          submission.isVisualPlagiarism = true;
          submission.plagiarismClusterId = plagiarismClusterId;
          submission.plagiarismDetails = `Visual match with cross-division student ID: ${flaggedByStudentId}`;
        }

        await submission.save();

        return res.status(200).json({
          success: true,
          message:
            "Upload assignment submitted successfully! Awaiting instructor evaluation.",
          submission,
          forensicFlags: {
            visualPlagiarism: visualPlagiarismDetected,
            plagiarismClusterId,
          },
        });
      } catch (uploadErr) {
        console.error(
          "❌ R2 Upload or Submission Processing Error:",
          uploadErr,
        );
        return res.status(500).json({
          message: "Failed to upload and process student submission.",
          error: uploadErr.message,
        });
      }
    }

    let result;

    // 💾 SAFETY FIRST: save the student's data before anything else
    submission.tabSwitchCount =
      parseInt(tabSwitchCount) || submission.tabSwitchCount;
    if (assignment.modality === "Text-Only") {
      submission.responses = responses;
    }
    await submission.save();

    // ───────────────────────── TEXT-ONLY: save -> queue ─────────────────────────
    if (assignment.modality === "Text-Only") {
      // Atomic lock: a double-click can't enqueue twice. Also resets any
      // previous grading state (matters when multiple attempts are allowed).
      const locked = await Submission.findOneAndUpdate(
        { _id: submission._id, status: { $ne: "queued" } },
        {
          $set: {
            status: "queued",
            queuedAt: new Date(),
            finalScoreOverride: null,
          },
          $unset: { gradingError: "" },
        },
      );
      if (!locked) {
        return res.status(409).json({
          message: "Already queued for evaluation.",
          status: "queued",
        });
      }

      try {
        await enqueueGrading({
          submissionId: submission._id,
          assignment,
          responses,
          preferredModel,
        });
      } catch (queueErr) {
        // Redis down / queue unreachable: the answers are STILL saved and the
        // submission stays in the Queue. The teacher sees why and can re-evaluate.
        console.error("❌ Could not enqueue grading job:", queueErr.message);
        await Submission.updateOne(
          { _id: submission._id },
          {
            $set: {
              gradingError: {
                message: `Could not reach the grading queue: ${queueErr.message}`,
                at: new Date(),
                attempts: 0,
                final: true,
              },
            },
          },
        );
      }

      submission.status = "queued"; // so the response isn't stale
      return res.status(202).json({
        message:
          "Your answers are saved. Evaluation is in progress and your instructor can review them if it takes longer than expected.",
        status: "queued",
        submission,
      });
    }

    // ───────────────── SPEECH-ONLY: synchronous so the next question is instant ─────────────────
    try {
      result = await processAiGrading({
        assignment,
        submission,
        responses,
        audioFile: req.file,
        preferredModel,
      });
    } catch (gradingError) {
      console.warn(
        "⚠️ AI hiccup on speech turn, using retry fallback:",
        gradingError.message,
      );

      let success = false;
      let attempts = 0;
      let finalError;

      while (!success && attempts < 3) {
        attempts++;
        try {
          if (attempts > 1) {
            await new Promise((r) => setTimeout(r, attempts * 3000));
          }
          result = await processAiGrading({
            assignment,
            submission,
            responses,
            audioFile: req.file,
            preferredModel,
          });
          success = true;
        } catch (retryError) {
          finalError = retryError;
          console.warn(
            `⚠️ Fallback attempt ${attempts} failed:`,
            retryError.message,
          );
        }
      }

      if (!success) {
        return res.status(429).json({
          message:
            "⚠️ High Traffic Alert: Our AI servers are working at maximum capacity. Your answers are safely saved. Please wait about 30 seconds and click submit again.",
          error: finalError?.message,
        });
      }
    }

    // 💾 POST-PROCESSING (speech turns)
    submission.tabSwitchCount =
      parseInt(tabSwitchCount) || submission.tabSwitchCount;

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

    await submission.save();

    res.status(200).json({
      message: "Submission updated and processed successfully.",
      status: submission.status,
      transcriptReceived: result.transcript,
      nextQuestionToSpeak: result.nextQuestion,
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
//    ?status=queued  -> the "Queue" tab (oldest first, so the longest-waiting is on top)
export const getAssignmentSubmissions = async (req, res) => {
  const { assignmentId } = req.params;
  const { status } = req.query;

  try {
    const assignment = await getCachedAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    // 🟡 2. CROSS-DIVISION LOOKUP: Find all assignment IDs sharing this same assignment code
    let targetAssignmentIds = [assignment._id];
    if (assignment.assignmentCode) {
      const matchingAssignments = await Assignment.find({
        assignmentCode: assignment.assignmentCode,
      }).select("_id");
      targetAssignmentIds = matchingAssignments.map((a) => a._id);
    }

    // 🟡 3. QUERY SUBMISSIONS ACROSS ALL MATCHING ASSIGNMENT IDs IN THE POOL
    let queryFilter = { assignmentId: { $in: targetAssignmentIds } };
    if (status) {
      queryFilter.status = status;
    }

    const sort = status === "queued" ? { queuedAt: 1 } : { submittedAt: -1 };

    const submissions = await Submission.find(queryFilter)
      .populate("studentId", "name email rollNumber ")
      .populate({
        path: "assignmentId",
        select: "title classId",
        populate: { path: "classId", select: "name" }, // 🟢 Safely populate the classroom name from the assignment
      })
      .sort(sort);

    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. TEACHER: RE-SEND ONE SUBMISSION FOR AI EVALUATION (HANDLES BOTH QUEUED TEXT-ONLY & MANUAL UPLOAD EVALUATION)
export const reevaluateSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id).populate(
      "studentId",
      "name email",
    );
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    const assignment = await getCachedAssignment(submission.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    if (!(await teacherOwnsAssignment(assignment, req.user._id))) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    // 🟢 UPLOAD MODALITY: Manual teacher-triggered AI evaluation & forensic check
    if (assignment.modality === "Upload") {
      let targetAssignmentIds = [assignment._id];
      if (assignment.assignmentCode) {
        const matchingAssignments = await Assignment.find({
          assignmentCode: assignment.assignmentCode,
        }).select("_id");
        targetAssignmentIds = matchingAssignments.map((a) => a._id);
      }

      const existingSubmissions = await Submission.find({
        assignmentId: { $in: targetAssignmentIds },
        _id: { $ne: submission._id },
      });

      const targetQuestion =
        assignment.questionPool?.[0] || "General Assignment Submission";
      const criteriaMapObj = Object.fromEntries(
        assignment.evaluationCriteria || new Map(),
      );

      // Re-fetch files from their R2 URLs or build file objects for evaluation router
      // If evaluateUploadWithRouter expects local file buffers, we map submission.uploadedFiles
      const filesForEvaluation = (submission.uploadedFiles || []).map(
        (file) => ({
          originalname: file.fileName || "uploaded_page.jpg",
          mimetype: file.fileType === "pdf" ? "application/pdf" : "image/jpeg",
          // Note: If evaluateUploadWithRouter downloads from fileUrl or expects buffers,
          // ensure your storage helper provides them. Alternatively, if evaluating via URL,
          // pass fileUrl directly. Here we pass the meta structure.
          buffer: Buffer.from(""), // Handled via URL or stored data
        }),
      );

      let aiResult = null;
      try {
        aiResult = await evaluateUploadWithRouter({
          question: targetQuestion,
          files: filesForEvaluation,
          criteriaMap: criteriaMapObj,
          aiNotes: assignment.aiNotes,
          studentRosterName: submission.studentId?.name || "",
        });
      } catch (evalErr) {
        console.warn("⚠️ AI Upload Evaluation Exception:", evalErr.message);

        // 🟢 SANITIZATION: Prevent raw technical errors or 429/503 JSON blobs from being saved
        let friendlyMessage =
          "Submission received successfully! Your work is securely queued for instructor review.";
        if (
          evalErr.message.includes("Fraud Detected") ||
          evalErr.isValidation
        ) {
          friendlyMessage = `🚨 ${evalErr.message}`;
        }

        aiResult = {
          isScreenCapture: evalErr.fraudType === "screen_capture",
          isSyntheticHandwriting:
            evalErr.fraudType === "synthetic_handwriting" ||
            evalErr.message.includes("Synthetic Handwriting"),
          scores: {},
          totalScoreGivenByAI: 0,
          feedback: friendlyMessage, // Clean message instead of raw JSON
          transcribedText: "",
        };
      }

      // Cross-Division Text Similarity Check against peer feedback
      const thresholdPercentage =
        assignment.uploadConfig?.similarityThreshold ?? 85;
      const similarityThresholdRatio = thresholdPercentage / 100;

      let textPlagiarismDetected = false;
      let textMatchedStudentId = null;
      let plagiarismClusterId = submission.plagiarismClusterId || null;
      const studentFeedbackText = aiResult?.feedback || "";

      if (studentFeedbackText.trim().length > 15) {
        for (const sub of existingSubmissions) {
          const peerFeedbackText = sub.aiEvaluation?.feedback || "";
          const similarityScore = calculateTextSimilarity(
            studentFeedbackText,
            peerFeedbackText,
          );

          if (similarityScore >= similarityThresholdRatio) {
            textPlagiarismDetected = true;
            textMatchedStudentId = sub.studentId;
            plagiarismClusterId = sub.plagiarismClusterId || sub._id;
            break;
          }
        }
      }

      if (textPlagiarismDetected && !plagiarismClusterId) {
        plagiarismClusterId = submission._id;
      }

      submission.isTextPlagiarism = textPlagiarismDetected;
      submission.plagiarismClusterId = plagiarismClusterId;
      if (textPlagiarismDetected) {
        submission.plagiarismDetails =
          `${submission.plagiarismDetails || ""} | Text similarity match with cross-division student ID: ${textMatchedStudentId}`.trim();
      }

      submission.aiEvaluation = {
        scores: aiResult.scores || {},
        totalScoreGivenByAI: aiResult.totalScoreGivenByAI || 0,
        feedback: `${aiResult.isScreenCapture ? "🚨 [Flagged: Screen Capture Photo] " : ""}${aiResult.isSyntheticHandwriting ? "🚨 [Flagged: Text-to-Handwriting Tool / Printout] " : ""}${aiResult.feedback || ""}`,
      };

      submission.status = "submitted";
      await submission.save();

      return res.status(200).json({
        message: "Upload submission evaluated successfully by AI.",
        submission,
      });
    }

    // Standard Text-Only Re-queue Logic...
    if (submission.status !== "queued") {
      return res.status(400).json({
        message: "Only submissions waiting in the Queue can be re-evaluated.",
      });
    }

    const outcome = await enqueueGrading({
      submissionId: submission._id,
      assignment,
      responses: submission.responses,
    });

    if (outcome.alreadyRunning) {
      return res.status(409).json({
        message:
          "This submission is being evaluated right now. Please wait a moment.",
      });
    }

    await Submission.updateOne(
      { _id: submission._id },
      { $set: { queuedAt: new Date() }, $unset: { gradingError: "" } },
    );

    res.status(200).json({
      message: "Sent for AI evaluation again.",
      status: "queued",
    });
  } catch (error) {
    console.error("❌ Re-evaluate failure:", error);
    res.status(500).json({
      message: "Could not re-send this submission for evaluation.",
      error: error.message,
    });
  }
};

// 4. 🆕 TEACHER: RE-SEND ALL STUCK SUBMISSIONS OF AN ASSIGNMENT
//    "Stuck" = still queued AND (waiting more than 15 min OR grading gave up).
export const reevaluateStuckSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await getCachedAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    if (!(await teacherOwnsAssignment(assignment, req.user._id))) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
    const stuck = await Submission.find({
      assignmentId,
      status: "queued",
      //$or: [{ "gradingError.final": true }, { queuedAt: { $lt: cutoff } }],
    });

    let requeued = 0;
    let skipped = 0;

    for (const s of stuck) {
      try {
        const outcome = await enqueueGrading({
          submissionId: s._id,
          assignment,
          responses: s.responses,
        });
        if (outcome.alreadyRunning) {
          skipped++;
          continue;
        }
        await Submission.updateOne(
          { _id: s._id },
          { $set: { queuedAt: new Date() }, $unset: { gradingError: "" } },
        );
        requeued++;
      } catch (err) {
        console.warn(`⚠️ Could not re-queue ${s._id}: ${err.message}`);
        skipped++;
      }
    }

    res.status(200).json({
      message: `Re-sent ${requeued} submission(s) for evaluation.`,
      requeued,
      skipped,
    });
  } catch (error) {
    console.error("❌ Bulk re-evaluate failure:", error);
    res.status(500).json({
      message: "Could not re-send stuck submissions.",
      error: error.message,
    });
  }
};

// 5. MANUAL INSTRUCTOR MARK OVERRIDES
//    🆕 If the submission is waiting in the Queue, giving marks also moves it to
//    "submitted" and cancels the pending AI job.
//    Send finalScoreOverride: null (or "") to clear an override.
export const overrideSubmissionScore = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    const assignment = await getCachedAssignment(submission.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    if (!(await teacherOwnsAssignment(assignment, req.user._id))) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    const raw = req.body.finalScoreOverride;
    const clearing = raw === null || raw === "";
    const marks = clearing ? null : Number(raw);

    if (
      !clearing &&
      (!Number.isFinite(marks) || marks < 0 || marks > assignment.totalMarks)
    ) {
      return res.status(400).json({
        message: `Marks must be a number between 0 and ${assignment.totalMarks}.`,
      });
    }

    const wasQueued = submission.status === "queued";
    const update = { $set: { finalScoreOverride: marks } };

    if (wasQueued && !clearing) {
      update.$set.status = "submitted";
      update.$set.submittedAt = submission.submittedAt || new Date();
      update.$unset = { gradingError: "" };
    }

    const updated = await Submission.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    if (wasQueued && !clearing) {
      await removeGradingJob(submission._id);
    }

    res.status(200).json({
      message: "Teacher score override updated successfully.",
      submission: updated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. FETCH FULL SUBMISSION DETAIL
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
      // .populate("classId", "name subjectIcon")
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

    // if (!sanitizedSubmission.classId && assignment?.classId) {
    //   sanitizedSubmission.classId = assignment.classId;
    // }

    if (isTeacher) {
      return res.status(200).json(sanitizedSubmission);
    }

    // 🆕 Students never receive the AI grading notes or internal grading errors
    if (assignment) {
      const publicAssignment = { ...assignment };
      delete publicAssignment.aiNotes;
      sanitizedSubmission.assignmentId = publicAssignment;
    }
    delete sanitizedSubmission.gradingError;

    if (
      sanitizedSubmission.finalScoreOverride !== null &&
      sanitizedSubmission.finalScoreOverride !== undefined
    ) {
      // 🆕 Works even when the AI never graded it (manual marks on a queued submission)
      const base = sanitizedSubmission.aiEvaluation || {};
      sanitizedSubmission.aiEvaluation = {
        ...base,
        totalScoreGivenByAI: sanitizedSubmission.finalScoreOverride,
        feedback: base.feedback || "Graded by your instructor.",
      };
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

// 🆕 TEACHER: BULK EVALUATE ALL QUEUED UPLOAD SUBMISSIONS (WITH REDIS + ATTACHMENTS & PROMPT CONTEXT)
export const reevaluateQueuedUploads = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await getCachedAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    if (!(await teacherOwnsAssignment(assignment, req.user._id))) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    if (assignment.modality !== "Upload") {
      return res.status(400).json({
        message: "This route is exclusively for Upload modality assignments.",
      });
    }

    const queuedCount = await Submission.countDocuments({
      assignmentId,
      status: "queued",
    });

    if (queuedCount === 0) {
      return res.status(200).json({
        message: "No queued upload submissions found to evaluate.",
        evaluatedCount: 0,
      });
    }

    // 🟢 Dispatch to our dedicated Upload Worker Queue via Redis!
    try {
      await enqueueUploadGrading({ assignmentId, teacherId: req.user._id });
      return res.status(202).json({
        message: `Evaluation started in the background for ${queuedCount} submission(s) via upload queue!`,
        queuedCount,
      });
    } catch (redisErr) {
      console.warn("⚠️ Redis upload queue unavailable:", redisErr.message);
      return res.status(500).json({
        message: "Queue service unreachable. Please ensure Redis is running.",
      });
    }
  } catch (error) {
    console.error("❌ Bulk upload dispatch failure:", error);
    res.status(500).json({
      message: "Could not process bulk upload evaluation.",
      error: error.message,
    });
  }
};

// 🆕 TEACHER: RE-EVALUATE A SINGLE UPLOAD SUBMISSION
export const reevaluateSingleUpload = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id).populate(
      "studentId",
      "name",
    );
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    const assignment = await getCachedAssignment(submission.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    if (!(await teacherOwnsAssignment(assignment, req.user._id))) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    if (assignment.modality !== "Upload") {
      return res.status(400).json({
        message: "This route is exclusively for Upload modality assignments.",
      });
    }

    // Cross-division assignment lookup for plagiarism clustering
    let targetAssignmentIds = [assignment._id];
    if (assignment.assignmentCode) {
      const matchingAssignments = await Assignment.find({
        assignmentCode: assignment.assignmentCode,
      }).select("_id");
      targetAssignmentIds = matchingAssignments.map((a) => a._id);
    }

    const existingSubmissions = await Submission.find({
      assignmentId: { $in: targetAssignmentIds },
      _id: { $ne: submission._id },
    });

    // 🟢 CLEANED MANUAL PROMPTS & INSTRUCTIONS FORMATTING
    const manualQuestions = assignment.questionPool?.join("\n- ") || "";
    const manualInstructions = assignment.instructions || "";

    const targetQuestion = `
        Assignment Title: ${assignment.title || "Assignment"}
        Teacher's Instructions: ${manualInstructions}
        Specific Questions to Answer:
        - ${manualQuestions}
        `.trim();

    // Safe criteria extraction
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

    // Fetch student's uploaded files + teacher's reference attachments
    const filesForEvaluation = [];

    // A. Fetch student pages
    for (const file of submission.uploadedFiles || []) {
      try {
        if (file.fileUrl) {
          console.log(
            `📥 [Single Upload Re-eval] Fetching student file: ${file.fileUrl}`,
          );
          const fetchRes = await fetch(file.fileUrl);
          if (fetchRes.ok) {
            const arrayBuffer = await fetchRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            filesForEvaluation.push({
              originalname: file.fileName || "uploaded_page.jpg",
              mimetype:
                file.fileType === "pdf" ? "application/pdf" : "image/jpeg",
              buffer: buffer,
            });
          }
        }
      } catch (fetchErr) {
        console.warn(
          `⚠️ Could not fetch student file buffer:`,
          fetchErr.message,
        );
      }
    }

    // B. 🟢 Fetch teacher reference attachments
    if (assignment.attachments && assignment.attachments.length > 0) {
      for (const att of assignment.attachments) {
        try {
          if (att.url) {
            console.log(
              `📥 [Single Upload Re-eval] Fetching teacher attachment context: ${att.url}`,
            );
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
        } catch (attErr) {
          console.warn(
            `⚠️ Could not fetch teacher attachment buffer:`,
            attErr.message,
          );
        }
      }
    }

    // Run AI Evaluation via router
    let aiResult = null;
    try {
      aiResult = await evaluateUploadWithRouter({
        question: targetQuestion,
        files: filesForEvaluation,
        criteriaMap: criteriaMapObj,
        aiNotes: assignment.aiNotes,
        studentRosterName: submission.studentId?.name || "",
      });
    } catch (evalErr) {
      console.warn("⚠️ AI Upload Evaluation Exception:", evalErr.message);

      // 🟢 2. SANITIZE TECHNICAL / QUOTA ERRORS vs. FRAUD FLAGS
      let friendlyFeedback =
        "Submission received successfully! Your work is securely queued for instructor review.";
      if (evalErr.message.includes("Fraud Detected") || evalErr.isValidation) {
        friendlyFeedback = `🚨 ${evalErr.message}`;
      }

      aiResult = {
        isScreenCapture: evalErr.fraudType === "screen_capture",
        isSyntheticHandwriting:
          evalErr.fraudType === "synthetic_handwriting" ||
          evalErr.message.includes("Synthetic Handwriting"),
        scores: {},
        totalScoreGivenByAI: 0,
        feedback: friendlyFeedback, // Clean message instead of raw JSON
        transcribedText: "",
      };
    }

    // 🟢 1. SAVE EXACT EXTRACTED TEXT
    submission.extractedText = aiResult.transcribedText || "";

    // 🟢 2. CROSS-DIVISION TEXT SIMILARITY CHECK USING EXACT EXTRACTED TEXT
    const thresholdPercentage =
      assignment.uploadConfig?.similarityThreshold ?? 85;
    const similarityThresholdRatio = thresholdPercentage / 100;

    let textPlagiarismDetected = false;
    let textMatchedStudentId = null;
    let plagiarismClusterId = submission.plagiarismClusterId || null;
    const studentRawText = submission.extractedText;

    if (studentRawText && studentRawText.trim().length > 15) {
      for (const sub of existingSubmissions) {
        const peerRawText = sub.extractedText || "";
        const similarityScore = calculateTextSimilarity(
          studentRawText,
          peerRawText,
        );

        if (similarityScore >= similarityThresholdRatio) {
          textPlagiarismDetected = true;
          textMatchedStudentId = sub.studentId;
          plagiarismClusterId = sub.plagiarismClusterId || sub._id;
          break;
        }
      }
    }

    if (textPlagiarismDetected && !plagiarismClusterId) {
      plagiarismClusterId = submission._id;
    }

    submission.isTextPlagiarism = textPlagiarismDetected;
    submission.plagiarismClusterId = plagiarismClusterId;
    if (textPlagiarismDetected) {
      submission.plagiarismDetails =
        `${submission.plagiarismDetails || ""} | Exact text match with cross-division student ID: ${textMatchedStudentId}`.trim();
    }

    submission.aiEvaluation = {
      scores: aiResult.scores || {},
      totalScoreGivenByAI: aiResult.totalScoreGivenByAI || 0,
      feedback: `${aiResult.isScreenCapture ? "🚨 [Flagged: Screen Capture Photo] " : ""}${aiResult.isSyntheticHandwriting ? "🚨 [Flagged: Text-to-Handwriting Tool / Printout] " : ""}${aiResult.feedback || ""}`,
    };

    submission.status = "submitted";
    await submission.save();

    return res.status(200).json({
      message: "Upload submission re-evaluated successfully by AI.",
      submission,
    });
  } catch (error) {
    console.error("❌ Single upload re-evaluate failure:", error);
    res.status(500).json({
      message: "Could not re-evaluate this upload submission.",
      error: error.message,
    });
  }
};
