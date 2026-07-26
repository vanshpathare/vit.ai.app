import mongoose from "mongoose";

const classroomSchema = new mongoose.Schema(
  {
    // 1. Core Meta Information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // 2. Teacher Relationship (Foreign Key to User Model)
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 3. Unique Short Invitation String (e.g., X7R9B2)
    classCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // 4. Enrolled Students Array Roster
    studentsEnrolled: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true, // Tracks exactly when the classroom room was created
  },
);

export default mongoose.model("Classroom", classroomSchema);
