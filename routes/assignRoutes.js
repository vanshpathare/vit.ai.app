import express from "express";
import {
  createAssignment,
  initializeOrGetSubmission,
  getClassAssignments,
  toggleResultPublish,
  updateAssignmentSettings,
  parseMaterialForQuestions,
} from "../controllers/assignController.js";
import { protect, teacherOnly } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Enforce baseline login verification across all assignment pathways
router.use(protect);

// 1. Fetch all assignments assigned inside a specific classroom container
router.get("/class/:classId", getClassAssignments);

// 2. Deploy a brand new assignment pool (Strictly Teacher role accounts)
router.post("/create", teacherOnly, createAssignment);

// 3. Start/Get a student test session (Picks and locks a random question from the pool)
router.post("/initialize", initializeOrGetSubmission);

// 4. Toggle visibility toggle switch on grades (Strictly Teacher role accounts)
router.put("/:id/publish", teacherOnly, toggleResultPublish);

// 5. Update assignment settings (Strictly Teacher role accounts)
router.put("/:id", teacherOnly, updateAssignmentSettings);

// 6. Generate a raw question pool out of uploaded text documents in memory
router.post(
  "/generate-from-material",
  teacherOnly,
  upload.single("docFile"),
  parseMaterialForQuestions,
);

export default router;
