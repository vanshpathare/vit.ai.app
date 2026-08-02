import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Resource title is required"],
      trim: true,
    },
    resourceType: {
      type: String,
      enum: ["file", "link"],
      required: true,
      default: "file",
    },
    url: {
      type: String,
      required: [true, "File URL or Link is required"],
    },
    // Useful metadata for displaying correct file icons (PDF, PPT, DOCX) in UI
    fileType: {
      type: String, // e.g., "pdf", "docx", "pptx", "drive", "youtube"
      default: "drive",
    },
    fileSize: {
      type: Number, // In bytes (optional, for Supabase uploads)
      default: 0,
    },
    // Links to the parent classroom
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
      index: true, // Speeds up queries when fetching files for a classroom
    },
    // Tracks who uploaded it (Teacher)
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Resource", resourceSchema);
