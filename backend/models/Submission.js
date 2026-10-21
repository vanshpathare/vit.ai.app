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

    uploadedFiles: [
      {
        fileUrl: { type: String, required: true }, // Cloudflare R2 public URL
        fileName: { type: String },
        fileType: {
          type: String,
          enum: ["image", "pdf"],
          required: true,
        }, // Explicitly separates camera images from PDF uploads
        pageNumber: { type: Number, default: 1 }, // Keeps sequential order for grading
        perceptualHash: { type: String, default: null },
      },
    ],

    // THE RANDOMIZATION SHIELD: Stores the specific question randomly selected for this student
    assignedQuestions: {
      type: [String],
      required: true,
      default: [],
    },

    // Modality Output Storage
    responses: [
      {
        questionText: {
          type: String,
          required: true,
        },
        answerText: {
          type: String,
          default: "",
        },
      },
    ],

    // ANTI-CHEAT METRIC: Tracks window out-of-focus event counts
    tabSwitchCount: {
      type: Number,
      default: 0,
    },

    plagiarismClusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      default: null,
    },
    isVisualPlagiarism: {
      type: Boolean,
      default: false,
    },
    isTextPlagiarism: {
      type: Boolean,
      default: false,
    },
    plagiarismDetails: {
      type: String,
      default: "",
    },

    extractedText: {
      type: String,
      default: "",
    },

    // Operational Lifecycle State
    status: {
      type: String,
      enum: ["pending", "queued", "submitted", "ongoing"],
      default: "pending",
    },
    queuedAt: { type: Date },
    gradingError: {
      message: String,
      at: Date,
      attempts: Number,
      final: Boolean,
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
