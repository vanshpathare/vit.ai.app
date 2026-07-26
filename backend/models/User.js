import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    // 1. Personal Identity Fields
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // Guarantees one unique account per email address
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },

    // 2. Access Control Layer
    role: {
      type: String,
      enum: ["teacher", "student"], // Strictly locks users into one of these two roles
      required: true,
    },

    // 3. OTP Verification Security Slots
    isVerified: {
      type: Boolean,
      default: false, // Account remains locked until OTP is successfully processed
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    resetPasswordOtp: { type: String, default: null },
    resetPasswordOtpExpires: { type: Date, default: null },
  },
  {
    timestamps: true, // Automatically injects createdAt and updatedAt date parameters
  },
);

// AUTOMATION HOOK: Hashes password securely using bcrypt before committing to MongoDB
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10); // Generate 10-round cryptographic salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// HELPER FUNCTION: Compares typed plaintext login passwords against the encrypted database hash
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
