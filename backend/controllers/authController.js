import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendOTPEmail } from "../services/emailService.js";

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "15d" });
};

// 1. REGISTER / RESUBMIT ACCOUNT (With Anti-Zombie Protection)
export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

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
    // 🧹 FIX: Injected error variable removed completely so production traffic flows smoothly!

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
