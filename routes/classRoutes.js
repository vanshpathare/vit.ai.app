import express from "express";
import {
  createClassroom,
  joinClassroom,
  getClassroomDetails,
  getUserClassrooms,
} from "../controllers/classController.js";
import { protect, teacherOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// All classroom management operations require a validated user token session
router.use(protect);

// 1. Fetch all classrooms linked to the currently logged-in user (Student or Teacher)
router.get("/my-classes", getUserClassrooms);

// 2. Classroom Access and Registration Gateways
router.post("/create", teacherOnly, createClassroom); // Only teachers can launch a new classroom
router.post("/join", joinClassroom); // Students use a unique token string to join

// 3. Roster Management
router.get("/:id", getClassroomDetails); // Retrieves the list of active users in the classroom

export default router;
