import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import Classroom from "../models/Classroom.js";
import { generateQuestionsFromMaterial } from "../services/geminiService.js";

// 1. CREATE AND BULK-DISTRIBUTE ASSIGNMENT (Teacher Only - Push Architecture)
export const createAssignment = async (req, res) => {
  const {
    classId,
    title,
    questionPool,
    modality,
    totalMarks,
    evaluationCriteria,
    aiNotes,
    dueDate,
  } = req.body;

  try {
    // 🔒 OWNERSHIP GUARDRAIL: Confirm classroom belongs to the teacher making the request
    const classroom = await Classroom.findOne({
      _id: classId,
      teacherId: req.user._id, // Matches the authenticated teacher's ID
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

    // A. Provision and save the Master Assignment Blueprint
    const assignment = await Assignment.create({
      classId,
      title,
      questionPool,
      modality,
      totalMarks,
      evaluationCriteria,
      aiNotes,
      dueDate,
    });

    // ⚡ B. AUTOMATED BULK DISTRIBUTION PIPELINE (Push Model)
    // Instantly generate individual submission slots for all currently enrolled students
    if (classroom.studentsEnrolled && classroom.studentsEnrolled.length > 0) {
      const submissionPromises = classroom.studentsEnrolled.map(
        async (studentId) => {
          // Randomize a question from the pool uniquely for this specific student's slot
          const randomIndex = Math.floor(Math.random() * questionPool.length);
          const selectedQuestion = questionPool[randomIndex];

          return Submission.create({
            assignmentId: assignment._id,
            studentId: studentId,
            assignedQuestion: selectedQuestion,
            status: "pending", // Appears instantly in their "Pending" dashboard section
            tabSwitchCount: 0,
          });
        },
      );

      // Execute all database insertion transactions concurrently in parallel
      await Promise.all(submissionPromises);
    }

    res.status(201).json({
      message:
        "Assignment successfully deployed and pushed to all active student rosters.",
      assignment,
    });
  } catch (error) {
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

      // Randomize index calculation (If pool length is 1, index will always be 0)
      const randomIndex = Math.floor(Math.random() * pool.length);
      const selectedQuestion = pool[randomIndex];

      submission = await Submission.create({
        assignmentId,
        studentId: req.user._id,
        assignedQuestion: selectedQuestion,
        status: "pending",
        tabSwitchCount: 0,
      });

      console.log(
        `✨ Late Joiner Handled: Dynamically allocated question slot for Student ID: ${req.user._id}`,
      );
    }

    // C. Return unified response payload structure back to the frontend dashboard view
    res.status(200).json({
      submissionId: submission._id,
      assignedQuestion: submission.assignedQuestion,
      status: submission.status,
      responseText: submission.responseText,
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
export const getClassAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({
      classId: req.params.classId,
    }).sort({ createdAt: -1 });
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    const questionPool = await generateQuestionsFromMaterial(
      req.file,
      questionCount,
      dynamicFocus,
    );

    res.status(200).json({
      message: "Questions extracted successfully from your materials.",
      questionPool,
    });
  } catch (error) {
    res.status(500).json({
      message: "Material parsing engine failure.",
      error: error.message,
    });
  }
};
