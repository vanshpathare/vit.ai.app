import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // THE RANDOMIZATION SHIELD: Stores the specific question randomly selected for this student
    assignedQuestion: {
      type: String,
      required: true,
    },

    // Modality Output Storage
    responseText: {
      type: String,
      default: "", // Holds typed response or the speech-to-text audio transcript
    },

    // ANTI-CHEAT METRIC: Tracks window out-of-focus event counts
    tabSwitchCount: {
      type: Number,
      default: 0,
    },

    // Operational Lifecycle State
    status: {
      type: String,
      enum: ["pending", "submitted", "ongoing"],
      default: "pending",
    },
    submittedAt: {
      type: Date,
    },
    conversationHistory: [
      {
        role: {
          type: String,
          enum: ["interviewer", "student"],
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // AI CORE EVALUATION PAYLOAD
    aiEvaluation: {
      scores: {
        type: Map,
        of: Number,
      }, // Matches the dynamic criteria points breakdown set by the teacher
      totalScoreGivenByAI: {
        type: Number,
      },
      feedback: {
        type: String,
      },
    },

    // MANUAL GRADING ESCAPE HATCH: Allows teachers to override the AI score if needed
    finalScoreOverride: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Enforce a unique compound index rule: A student can only have ONE unique submission slot per assignment
submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export default mongoose.model("Submission", submissionSchema);
