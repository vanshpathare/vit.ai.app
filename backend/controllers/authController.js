import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendOTPEmail } from "../services/emailService.js";
import { parseRollNumber } from "../utils/rollNumberSort.js";

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "15d" });
};

// 🟢 NEW: Light format check — same shape the sort comparator expects (2-digit year
// ... 1 letter ... 4-digit serial). Doesn't hard-fail on unusual middle segments,
// just confirms the three pieces that actually matter for sorting are present.
const isPlausibleRollNumber = (value) =>
  /^\d{2}.*?[A-Za-z]\d{4}$/.test((value || "").trim());

// 1. REGISTER / RESUBMIT ACCOUNT (With Anti-Zombie Protection)
export const registerUser = async (req, res) => {
  const { name, email, password, role, rollNumber } = req.body;

  try {
    // 🎓 1. VIT CAMPUS DOMAIN GUARDRAIL
    const vitDomainRegex = /^[a-zA-Z0-9._%+-]+@vit\.edu\.in$/;

    if (!vitDomainRegex.test(email)) {
      return res.status(403).json({
        message:
          "Access Denied. Registration is strictly restricted to Vidyalankar Institute of Technology students and faculty (@vit.edu.in).",
      });
    }

    // 🔒 2. STRONG PASSWORD SECURITY GUARDRAIL
    // Enforces: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol
    const strongPasswordRegex =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Weak Password. Your password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character (e.g., @$!%*?&#).",
      });
    }

    // 🟢 3. ROLL NUMBER GUARDRAIL (Students only — teachers don't have one)
    const normalizedRoll = rollNumber ? rollNumber.trim().toUpperCase() : "";
    if (role === "student") {
      if (!normalizedRoll) {
        return res.status(400).json({
          message: "Roll number is required for student registration.",
        });
      }
      if (!isPlausibleRollNumber(normalizedRoll)) {
        return res.status(400).json({
          message:
            "Roll number format looks invalid. Expected something like 24102B0011.",
        });
      }
    }

    // ─── EXISTING REGISTRATION ENGINE CONTINUES BELOW ───
    const normalizedEmail = email.toLowerCase(); // Normalize early for structural data safety
    const existingUser = await User.findOne({ email: normalizedEmail });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({
          message: "This email is already linked to an active account.",
        });
      }

      // ANTI-ZOMBIE FIX: If unverified, overwrite old state with fresh inputs
      existingUser.name = name;
      existingUser.password = password; // Triggers pre-save hashing
      existingUser.role = role;
      if (role === "student") existingUser.rollNumber = normalizedRoll; // 🟢 NEW
      existingUser.otp = otp;
      existingUser.otpExpires = otpExpires;
      await existingUser.save();

      const emailSent = await sendOTPEmail(
        existingUser.email,
        existingUser.name,
        otp,
      );
      return res.status(200).json({
        message:
          "Previous unverified registration detected. Fresh OTP sent successfully!",
        emailSuccess: emailSent,
      });
    }

    // Standard baseline registration for brand new emails
    const user = await User.create({
      name,
      email: normalizedEmail, // Ensure database records stay purely lowercase
      password,
      role,
      rollNumber: role === "student" ? normalizedRoll : null, // 🟢 NEW
      otp,
      otpExpires,
    });

    const emailSent = await sendOTPEmail(user.email, user.name, otp);
    res.status(201).json({
      message:
        "Registration initialized. Please check your email for the verification OTP.",
      emailSuccess: emailSent,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Registration pipeline failed.", error: error.message });
  }
};

// 2. VERIFY OTP (Activates Account)
export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ message: "User record not found." });

    if (!user.otp || user.otp !== otp || new Date() > user.otpExpires) {
      return res.status(400).json({ message: "Invalid or expired OTP code." });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({
      message: "Account successfully verified!",
      token: generateToken(user._id, user.role),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber, // 🟢 NEW: so the frontend has it immediately after login
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "OTP verification failed.", error: error.message });
  }
};

// 3. SECURE LOGIN
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password." });

    if (!user.isVerified) {
      return res.status(403).json({
        message:
          "Account is unverified. Please re-register to get a fresh OTP.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password." });

    res.status(200).json({
      token: generateToken(user._id, user.role),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber, // 🟢 NEW
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Login execution failed.", error: error.message });
  }
};

// 4. GENERATE PASSWORD RECOVERY OTP (Forgot Password Request)
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(200).json({
        message:
          "If that email matches an active account, a recovery OTP has been dispatched.",
      });
    }

    if (!user.isVerified) {
      return res.status(400).json({
        message:
          "This account is unverified. Please re-register instead to trigger registration checks.",
      });
    }

    const recoveryOtp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordOtp = recoveryOtp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const emailSent = await sendOTPEmail(user.email, user.name, recoveryOtp);

    res.status(200).json({
      message:
        "If that email matches an active account, a recovery OTP has been dispatched.",
      emailSuccess: emailSent,
    });
  } catch (error) {
    res.status(500).json({
      message: "Password recovery pipeline failed.",
      error: error.message,
    });
  }
};

// 5. CONSUME OTP & UPDATE PASSWORD STATE (Reset Execution)
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    // 🔒 STRONG PASSWORD SECURITY GUARDRAIL (Re-applied for recovery resets)
    const strongPasswordRegex =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Weak Password. Your new password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character (e.g., @$!%*?&#).",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ message: "User record not located." });

    // Validate the OTP payload match and verify expiration timeline constraint
    if (
      !user.resetPasswordOtp ||
      user.resetPasswordOtp !== otp ||
      new Date() > user.resetPasswordOtpExpires
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password recovery OTP." });
    }

    // Set the fresh text selection string. The pre-save hook will capture and encrypt this automatically.
    user.password = newPassword;

    // Flush the security token slots out to clear the state completely
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    await user.save();

    res.status(200).json({
      message:
        "Password updated and encrypted successfully! You can now log in.",
    });
  } catch (error) {
    res.status(500).json({
      message: "Password adjustment pipeline crash.",
      error: error.message,
    });
  }
};

// 6. 🟢 NEW: SELF-SERVICE ROLL NUMBER BACKFILL (Migration helper)
// For students who registered before the rollNumber field existed. Lets a logged-in
// student set (or correct, if empty) their own roll number once. Wire this into
// Account.jsx as a small form when rollNumber is missing — or a teacher can set it
// manually on the roster once ClassDetail.jsx supports it.
export const updateOwnRollNumber = async (req, res) => {
  const { rollNumber } = req.body;

  try {
    if (req.user.role !== "student") {
      return res.status(400).json({
        message: "Only student accounts have a roll number.",
      });
    }

    const normalizedRoll = (rollNumber || "").trim().toUpperCase();
    if (!normalizedRoll) {
      return res.status(400).json({ message: "Roll number cannot be empty." });
    }
    if (!isPlausibleRollNumber(normalizedRoll)) {
      return res.status(400).json({
        message:
          "Roll number format looks invalid. Expected something like 24102B0011.",
      });
    }

    const user = await User.findById(req.user._id);
    user.rollNumber = normalizedRoll;
    await user.save();

    res.status(200).json({
      message: "Roll number updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update roll number.",
      error: error.message,
    });
  }
};
