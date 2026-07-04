import express from "express";
import {
  submitAssignment,
  getAssignmentSubmissions,
  overrideSubmissionScore,
  getStudentSubmissionDetails,
  logSubmissionInfraction,
} from "../controllers/submitController.js";
import { protect, teacherOnly } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Enforce baseline user verification across all submission paths
router.use(protect);

// 1. Process and evaluate student work (Catches file binaries inside 'audio' fields dynamically)
// Target URL: POST /api/submissions/execute
router.post("/execute", upload.single("audio"), submitAssignment);

// 2. Fetch the complete classroom grading roster sheet (Strictly Teacher role accounts)
// Target URL: GET /api/submissions/assignment/:assignmentId
router.get("/assignment/:assignmentId", teacherOnly, getAssignmentSubmissions);

// 3. Manually overwrite a student's score parameters (Strictly Teacher role accounts)
// Target URL: PUT /api/submissions/override/:id
router.put("/override/:id", teacherOnly, overrideSubmissionScore);

router.get("/:id", getStudentSubmissionDetails);

// Target URL: PATCH /api/submissions/log-infraction/:id
router.patch("/log-infraction/:id", logSubmissionInfraction);

export default router;
