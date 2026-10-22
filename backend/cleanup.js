import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./config/db.js"; // Adjust path to your database config if needed
import Assignment from "./models/Assignment.js";
import Submission from "./models/Submission.js";

const runCleanup = async () => {
  try {
    await connectDB();
    console.log("🔌 Connected to database for cleanup...");

    // 1. Find all assignments matching the code
    const matchingAssignments = await Assignment.find({
      assignmentCode: "UP-FCE4D4",
    }).select("_id");
    const assignmentIds = matchingAssignments.map((a) => a._id);

    if (assignmentIds.length === 0) {
      console.log("⚠️ No assignments found with code UP-FCE4D4.");
      process.exit(0);
    }

    // 2. Reset stale plagiarism flags
    const result = await Submission.updateMany(
      { assignmentId: { $in: assignmentIds } }, // Clears for all matching submissions, or keep { isTextPlagiarism: true } if preferred
      {
        $set: {
          status: "queued", // 🟢 Reset status back to queued
          queuedAt: new Date(), // 🟢 Fresh queue timestamp
          isTextPlagiarism: false,
          plagiarismClusterId: null,
          plagiarismDetails: "",
        },
        $unset: { gradingError: "" }, // Clears any old error logs
      },
    );

    console.log(
      `🧹 Cleaned up stale plagiarism flags for ${result.modifiedCount} submissions!`,
    );
    process.exit(0);
  } catch (err) {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  }
};

runCleanup();
