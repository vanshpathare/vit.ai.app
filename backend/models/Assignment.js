import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  resourceType: {
    type: String,
    enum: ["file", "link"],
    required: true,
    default: "file",
  },
  url: {
    type: String,
    required: [true, "Attachment URL or Link is required"],
  },
  fileName: {
    type: String,
    required: [true, "Attachment name is required"],
    trim: true,
  },
  fileType: {
    type: String, // e.g. "pdf", "docx", "drive", "youtube"
    default: "file",
  },
});

const assignmentSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // RANDOMIZATION FIX: Changed from a single string to a structural pool array of question strings
    questionPool: [
      {
        type: String,
        required: true,
      },
    ],

    questionsPerStudent: {
      type: Number,
      default: 1, // Fallback to 1 question if not specified
    },

    modality: {
      type: String,
      enum: ["Text-Only", "Speech-Only"],
      required: true,
    },
    totalMarks: {
      type: Number,
      required: true,
    },
    evaluationCriteria: {
      type: Map,
      of: Number,
      default: () => new Map(),
      required: true,
    },
    aiNotes: {
      type: String,
      trim: true,
    },
    // 🟢 NEW: Teacher-written dos/don'ts shown to students before and during the
    // assignment (e.g. "No outside references allowed", "Answer in full sentences").
    // Distinct from `aiNotes`, which is grading guidance for the AI and is never
    // shown to students.
    instructions: {
      type: String,
      trim: true,
      default: "",
    },

    attachments: [attachmentSchema],

    dueDate: {
      type: Date,
      required: true,
    },

    // VISIBILITY FEATURE: Controls whether students can see their AI scores yet
    isResultPublished: {
      type: Boolean,
      default: true, // Hidden by default until the teacher clicks "Publish"
    },

    // ATTEMPTS CONTROL: If true, students can overwrite and re-evaluate their scores
    allowMultipleSubmissions: {
      type: Boolean,
      default: false, // Default to safe "Exam Mode" (Only once)
    },

    distributionType: {
      type: String,
      enum: ["random", "same-for-all"],
      default: "same-for-all", // Safeguards it by defaulting to standard randomized mode
    },
  },
  {
    timestamps: true,
  },
);

assignmentSchema.pre("save", function (next) {
  if (!this.evaluationCriteria || this.evaluationCriteria.size === 0) {
    this.evaluationCriteria = new Map([
      ["Overall Performance", this.totalMarks || 20],
    ]);
  }
  next();
});

export default mongoose.model("Assignment", assignmentSchema);
