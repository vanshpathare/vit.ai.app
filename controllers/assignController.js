import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import Classroom from "../models/Classroom.js";
import { generateQuestionsFromMaterial } from "../services/geminiService.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";
import PDFParser from "pdf2json";

// 1. CREATE AND BULK-DISTRIBUTE ASSIGNMENT (Teacher Only - Push Architecture)
export const createAssignment = async (req, res) => {
  const {
    classId,
    title,
    questionPool,
    questionsPerStudent,
    modality,
    totalMarks,
    evaluationCriteria,
    aiNotes,
    dueDate,
    distributionType,
    isResultPublished,
    allowMultipleSubmissions,
  } = req.body;

  try {
    // 🔒 OWNERSHIP GUARDRAIL: Confirm classroom belongs to the teacher making the request
    const classroom = await Classroom.findOne({
      _id: classId,
      teacherId: req.user._id,
    });

    if (!classroom) {
      return res.status(403).json({
        message:
          "Unauthorized action. You are not authorized to deploy assignments to this classroom.",
      });
    }

    // Validation check for the question pool array
    if (
      !questionPool ||
      !Array.isArray(questionPool) ||
      questionPool.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Assignment requires a valid question pool array." });
    }

    const countPerStudent = parseInt(questionsPerStudent) || 1;

    // A. Provision and save the Master Assignment Blueprint
    const assignment = await Assignment.create({
      classId,
      title,
      questionPool,
      questionsPerStudent: countPerStudent,
      modality,
      totalMarks,
      evaluationCriteria,
      aiNotes,
      dueDate,
      distributionType: distributionType || "same-for-all",
      isResultPublished: isResultPublished ?? false,
      allowMultipleSubmissions: allowMultipleSubmissions ?? false,
    });

    // ⚡ B. AUTOMATED BULK DISTRIBUTION PIPELINE (Optimized Bulk Push Model)
    if (classroom.studentsEnrolled && classroom.studentsEnrolled.length > 0) {
      // Pre-calculate a uniform question IF the teacher chose "same-for-all"

      const uniformQuestion = [...questionPool];

      // Prepare an array of raw document objects in memory
      const submissionDocs = classroom.studentsEnrolled.map((studentId) => {
        let assignedQuestionsArray = [];

        if (distributionType === "same-for-all") {
          assignedQuestionsArray = uniformQuestion; // Everyone gets the exact same question
        } else {
          // "random": Shuffle the pool uniquely for this student and slice out the requested amount
          const shuffledPool = [...questionPool].sort(
            () => 0.5 - Math.random(),
          );
          assignedQuestionsArray = shuffledPool.slice(
            0,
            Math.min(countPerStudent, questionPool.length),
          );
        }

        return {
          assignmentId: assignment._id,
          studentId: studentId,
          assignedQuestions: assignedQuestionsArray,
          status: "pending",
          tabSwitchCount: 0,
        };
      });

      // 🏎️ Bulk insert all rows at once! 1 single connection, 1 single trip to MongoDB.
      await Submission.insertMany(submissionDocs);
    }

    res.status(201).json({
      message:
        "Assignment successfully deployed and pushed to all active student rosters.",
      assignment,
    });
  } catch (error) {
    console.error("❌ Assignment deployment failure:", error);
    res.status(500).json({
      message: "Assignment deployment and broadcast pipeline failed.",
      error: error.message,
    });
  }
};

// 2. RETRIEVE PRE-ALLOCATED LOCKED QUESTION SLOT (Student Only)
// 2. RETRIEVE OR DYNAMICALLY PROVISION QUESTION SLOT (Handles Late Joiners Fluently)
export const initializeOrGetSubmission = async (req, res) => {
  const { assignmentId } = req.body;

  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment)
      return res.status(404).json({ message: "Assignment target not found." });

    // A. Look for the pre-generated submission row created during the teacher's bulk broadcast
    let submission = await Submission.findOne({
      assignmentId,
      studentId: req.user._id, // Matches the authenticated student's ID
    });

    // ⚡ B. AUTOMATED LATE-JOINER RESOLUTION CHECK
    // If no row exists, this student joined the class code after deployment. Spin up a slot for them instantly!
    if (!submission) {
      const pool = assignment.questionPool;

      // Edge-case defensive check: Make sure the assignment actually has questions
      if (!pool || pool.length === 0) {
        return res
          .status(400)
          .json({ message: "Target assignment has an empty question pool." });
      }

      let assignedQuestionsArray = [];
      const countPerStudent = assignment.questionsPerStudent || 1;

      if (assignment.distributionType === "same-for-all") {
        // Find an active classmate's row to copy their exact question array setup
        const classmateSubmission = await Submission.findOne({ assignmentId });
        assignedQuestionsArray = classmateSubmission
          ? classmateSubmission.assignedQuestions
          : [...pool];
      } else {
        // Give them a unique randomized subset sliced to the specified quantity limit
        const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
        assignedQuestionsArray = shuffledPool.slice(
          0,
          Math.min(countPerStudent, pool.length),
        );
      }

      submission = await Submission.create({
        assignmentId,
        studentId: req.user._id,
        assignedQuestions: assignedQuestionsArray,
        status: "pending",
        tabSwitchCount: 0,
        responses: [],
      });

      console.log(
        `✨ Late Joiner Handled: Dynamically allocated question slot for Student ID: ${req.user._id}`,
      );
    }

    // C. Return unified response payload structure back to the frontend dashboard view
    res.status(200).json({
      submissionId: submission._id,
      assignedQuestions: submission.assignedQuestions,
      status: submission.status,
      responses: submission.responses || [],
      modality: assignment.modality,
      title: assignment.title,
      dueDate: assignment.dueDate,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to safely spin up student assignment session.",
      error: error.message,
    });
  }
};

// 3. FETCH ALL ACTIVE ASSIGNMENTS INSIDE A CLASSROOM (Both Roles)
// export const getClassAssignments = async (req, res) => {
//   try {
//     const assignments = await Assignment.find({
//       classId: req.params.classId,
//     }).sort({ createdAt: -1 });
//     res.status(200).json(assignments);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
export const getClassAssignments = async (req, res) => {
  try {
    const { classId } = req.params;
    const studentId = req.user._id; // Logged-in student's ID from your auth middleware

    // 1. Fetch all raw assignments configured for this specific class
    const assignments = await Assignment.find({ classId: classId });

    // 2. Fetch all submissions made by THIS student in this classroom
    const studentSubmissions = await Submission.find({
      studentId: studentId,
      // Only get submissions that match the assignments we just found
      assignmentId: { $in: assignments.map((a) => a._id) },
    });

    // 3. 🟢 COMBINE THEM: Map over assignments and temporarily inject the submission status
    const processedAssignments = assignments.map((assignment) => {
      // Check if this student has an existing submission document for this assignment
      const matchingSubmission = studentSubmissions.find(
        (sub) => sub.assignmentId.toString() === assignment._id.toString(),
      );

      // Convert Mongoose document to plain JS object so we can add runtime fields
      return {
        ...assignment.toObject(),

        // If a submission exists, use its real status ("submitted"). Otherwise, default to "pending"!
        status: matchingSubmission ? matchingSubmission.status : "pending",

        // Pass along the submissionId so the frontend knows exactly which submission workspace to open
        submissionId: matchingSubmission ? matchingSubmission._id : null,
      };
    });

    // 4. Send the processed array to the frontend
    res.status(200).json(processedAssignments);
  } catch (error) {
    res.status(500).json({
      message: "Error mapping assignment completion states.",
      error: error.message,
    });
  }
};

// 4. TOGGLE MARKS VISIBILITY SEEN / NOT SEEN (Teacher Only)
export const toggleResultPublish = async (req, res) => {
  const { isResultPublished } = req.body;
  try {
    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { $set: { isResultPublished } },
      { new: true },
    );
    if (!assignment)
      return res
        .status(404)
        .json({ message: "Assignment target not located." });

    res.status(200).json({
      message: isResultPublished
        ? "Grades published live to students."
        : "Grades hidden from students.",
      assignment,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. UPDATE ASSIGNMENT SETTINGS (Teacher Only)
export const updateAssignmentSettings = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment)
      return res.status(404).json({ message: "Assignment not found." });

    const classroom = await Classroom.findOne({
      _id: assignment.classId,
      teacherId: req.user._id,
    });
    if (!classroom)
      return res.status(403).json({ message: "Unauthorized action." });

    const updatedAssignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      message: "Assignment settings updated live.",
      assignment: updatedAssignment,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update settings.", error: error.message });
  }
};

// 6. GENERATE QUESTION POOLS DYNAMICALLY FROM UPLOADED REFERENCE MATERIALS (Teacher Only)
export const parseMaterialForQuestions = async (req, res) => {
  const { count, dynamicFocus } = req.body;

  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Missing document file attachment upload." });
    }

    const questionCount = parseInt(count) || 5;
    let extractedText = "";
    const fileExtension = req.file.originalname.split(".").pop().toLowerCase();

    // 🏎️ EXTRACT TEXT BASED ON FILE TYPE
    if (fileExtension === "pdf" || req.file.mimetype === "application/pdf") {
      extractedText = await new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, 1); // '1' flag extracts raw text content cleanly

        pdfParser.on("pdfParser_dataError", (errData) =>
          reject(errData.parserError),
        );
        pdfParser.on("pdfParser_dataReady", (pdfData) => {
          // pdf2json parses lines into URL-encoded format; this decodes it into standard text strings
          const rawText = pdfParser.getRawTextContent();
          resolve(decodeURIComponent(rawText));
        });

        // Load the memory buffer directly
        pdfParser.parseBuffer(req.file.buffer);
      });
    } else if (fileExtension === "docx") {
      const docResult = await mammoth.extractRawText({
        buffer: req.file.buffer,
      });
      extractedText = docResult.value;
    } else {
      // Fallback for standard .txt or .md files
      extractedText = req.file.buffer.toString("utf-8");
    }

    // Safety check: Ensure we actually got readable text out of the file
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        message:
          "Could not extract text from this document. Ensure it's not a scanned image file.",
      });
    }

    // 🧠 PASS THE CLEAN TEXT STRING INTO YOUR AI GENERATOR HELPER
    // Note: Inside generateQuestionsFromMaterial, make sure you use this text instead of req.file!
    const questionPool = await generateQuestionsFromMaterial(
      extractedText, // ◄── Pass the clean text string directly here!
      questionCount,
      dynamicFocus,
    );

    res.status(200).json({
      message: "Questions extracted successfully from your materials.",
      questionPool,
    });
  } catch (error) {
    console.error("❌ Material parsing engine failure:", error);
    res.status(500).json({
      message: "Material parsing engine failure.",
      error: error.message,
    });
  }
};
