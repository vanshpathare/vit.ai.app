import express from "express";
import {
  registerUser,
  verifyOTP,
  loginUser,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

// 1. Core Authentication Cycle Endpoints
router.post("/register", registerUser);
router.post("/verify-otp", verifyOTP);
router.post("/login", loginUser);

// 2. Password Recovery Management Endpoints
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
