import Classroom from "../models/Classroom.js";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";

// 1. CREATE NEW CLASSROOM (Teacher Only)
export const createClassroom = async (req, res) => {
  const { name, description } = req.body;

  try {
    let isUnique = false;
    let classCode = "";

    // Loop runs until an absolutely unique 6-character alphanumeric code is found
    while (!isUnique) {
      classCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingClass = await Classroom.findOne({ classCode });
      if (!existingClass) isUnique = true;
    }

    // req.user._id is attached automatically by our protect middleware
    const newClass = await Classroom.create({
      name,
      description,
      teacherId: req.user._id,
      classCode,
    });

    res.status(201).json({
      message: "Classroom provisioned successfully.",
      classroom: newClass,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Classroom creation failed.", error: error.message });
  }
};

// 2. JOIN CLASSROOM USING CODE (Student Only)
export const joinClassroom = async (req, res) => {
  const { classCode } = req.body;

  try {
    if (!classCode) {
      return res
        .status(400)
        .json({ message: "Classroom invitation code is required." });
    }

    const classroom = await Classroom.findOne({
      classCode: classCode.toUpperCase(),
    });
    if (!classroom) {
      return res
        .status(404)
        .json({ message: "Invalid classroom code. Check input values." });
    }

    // Prevent duplicate enrollment in the same roster array
    if (classroom.studentsEnrolled.includes(req.user._id)) {
      return res.status(400).json({
        message: "You are already registered inside this classroom roster.",
      });
    }

    // Add student ID to the array and commit changes
    classroom.studentsEnrolled.push(req.user._id);
    await classroom.save();

    res.status(200).json({
      message: "Classroom synced successfully!",
      classroomName: classroom.name,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to complete classroom enrollment sync.",
      error: error.message,
    });
  }
};

// 3. FETCH ROLE-SPECIFIC CLASSES (Both Roles)
export const getUserClassrooms = async (req, res) => {
  try {
    let classrooms;

    // Smart routing filter based on the token's authenticated user role
    if (req.user.role === "teacher") {
      classrooms = await Classroom.find({ teacherId: req.user._id });
    } else {
      classrooms = await Classroom.find({
        studentsEnrolled: req.user._id,
      }).populate("teacherId", "name email"); // Merges teacher metadata inline automatically
    }

    res.status(200).json(classrooms);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Data fetch failed.", error: error.message });
  }
};

// 4. FETCH SINGLE CLASSROOM DETAILS & FULL ROSTER
export const getClassroomDetails = async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate("studentsEnrolled", "name email") // Replaces student ObjectIds with real names and emails
      .populate("teacherId", "name email");

    if (!classroom) {
      return res.status(404).json({ message: "Classroom target not found." });
    }

    res.status(200).json(classroom);
  } catch (error) {
    res.status(500).json({
      message: "Failed to gather structural detail payload.",
      error: error.message,
    });
  }
};

// 5. 🟢 NEW: GENERATE GRADEBOOK DATA FOR EXCEL EXPORT (Teacher Only)
// Returns the classroom roster (already alphabetically sorted by name), every
// assignment created in this classroom, and every *submitted* grade. The frontend
// uses the teacher's manual override when present and falls back to the AI-given
// score otherwise, then builds the .xlsx file client-side.
export const getClassGradebook = async (req, res) => {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      teacherId: req.user._id,
    }).populate("studentsEnrolled", "name email");

    if (!classroom) {
      return res.status(403).json({
        message:
          "Unauthorized action. You are not authorized to view this classroom's gradebook.",
      });
    }

    const assignments = await Assignment.find({ classId: req.params.id })
      .select("title totalMarks createdAt")
      .sort({ createdAt: 1 });

    const submissions = await Submission.find({
      assignmentId: { $in: assignments.map((a) => a._id) },
      status: "submitted",
    }).select("assignmentId studentId aiEvaluation finalScoreOverride");

    // Sort the roster alphabetically by name before sending it back
    const sortedStudents = [...classroom.studentsEnrolled].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );

    res.status(200).json({
      classroomName: classroom.name,
      students: sortedStudents,
      assignments,
      submissions,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to compile gradebook data.",
      error: error.message,
    });
  }
};
