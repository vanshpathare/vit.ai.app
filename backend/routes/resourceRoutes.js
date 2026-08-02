import express from "express";
import {
  getClassroomResources,
  createResource,
  deleteResource,
} from "../controllers/resourceController.js";
import { protect, teacherOnly } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);

// 📂 Fetch all files/links for a specific classroom's Files Tab
router.get("/classroom/:classId", getClassroomResources);

// 📤 Upload a general file or add a Drive/YouTube link to the classroom
router.post(
  "/classroom/:classId",
  teacherOnly,
  upload.single("file"),
  createResource,
);

// 🗑️ Delete a resource
router.delete("/:resourceId", teacherOnly, deleteResource);

export default router;
