import express from "express";
import {
  registerUser,
  verifyOTP,
  loginUser,
  forgotPassword,
  resetPassword,
  updateOwnRollNumber,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. Core Authentication Cycle Endpoints
router.post("/register", registerUser);
router.post("/verify-otp", verifyOTP);
router.post("/login", loginUser);

// 2. Password Recovery Management Endpoints
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// 3. Self-service roll number backfill for students who registered before
router.patch("/roll-number", protect, updateOwnRollNumber);

export default router;
