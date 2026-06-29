import mongoose from "mongoose";

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
      required: true,
    },
    aiNotes: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },

    // VISIBILITY FEATURE: Controls whether students can see their AI scores yet
    isResultPublished: {
      type: Boolean,
      default: false, // Hidden by default until the teacher clicks "Publish"
    },

    // ATTEMPTS CONTROL: If true, students can overwrite and re-evaluate their scores
    allowMultipleSubmissions: {
      type: Boolean,
      default: false, // Default to safe "Exam Mode" (Only once)
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Assignment", assignmentSchema);
