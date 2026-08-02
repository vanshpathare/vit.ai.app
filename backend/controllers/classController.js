import Classroom from "../models/Classroom.js";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import { sortStudentsByRollNumber } from "../utils/rollNumberSort.js";

// 1. CREATE NEW CLASSROOM (Teacher Only)
// 🟢 UPDATED: now accepts subjectIcon (which image/gradient key the teacher picked
// for this classroom's card). Defaults to "general" if omitted so old client builds
// that don't send it yet won't break.
export const createClassroom = async (req, res) => {
  const { name, description, subjectIcon } = req.body;

  try {
    let isUnique = false;
    let classCode = "";

    while (!isUnique) {
      classCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingClass = await Classroom.findOne({ classCode });
      if (!existingClass) isUnique = true;
    }

    const newClass = await Classroom.create({
      name,
      description,
      subjectIcon: subjectIcon || "general", // 🟢 NEW
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

    if (classroom.studentsEnrolled.includes(req.user._id)) {
      return res.status(400).json({
        message: "You are already registered inside this classroom roster.",
      });
    }

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

    if (req.user.role === "teacher") {
      classrooms = await Classroom.find({ teacherId: req.user._id });
    } else {
      classrooms = await Classroom.find({
        studentsEnrolled: req.user._id,
      }).populate("teacherId", "name email");
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
      .populate("studentsEnrolled", "name email rollNumber")
      .populate("teacherId", "name email");

    if (!classroom) {
      return res.status(404).json({ message: "Classroom target not found." });
    }

    const classroomObj = classroom.toObject();
    classroomObj.studentsEnrolled = sortStudentsByRollNumber(
      classroomObj.studentsEnrolled,
    );

    res.status(200).json(classroomObj);
  } catch (error) {
    res.status(500).json({
      message: "Failed to gather structural detail payload.",
      error: error.message,
    });
  }
};

// 5. GENERATE GRADEBOOK DATA FOR EXCEL EXPORT (Teacher Only)
export const getClassGradebook = async (req, res) => {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      teacherId: req.user._id,
    }).populate("studentsEnrolled", "name email rollNumber");

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

    const sortedStudents = sortStudentsByRollNumber(classroom.studentsEnrolled);

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
