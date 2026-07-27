import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  getClassroomDetailsAPI,
  getClassAssignmentsAPI,
  getClassGradebookAPI,
} from "../../services/api";
import AssignmentEditorModal from "../../components/teacher/AssignmentEditorModal";
import { getInitials } from "../../utils/getInitials";
import { compareRollNumbers } from "../../utils/rollNumberSort"; // 🟢 NEW

function ClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState("assignments");
  const [isLoading, setIsLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const fetchClassroom = async () => {
    try {
      setIsLoading(true);
      const response = await getClassroomDetailsAPI(classId);
      setClassroom(response.data);
    } catch (err) {
      console.error("Failed to load classroom:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      setIsAssignmentsLoading(true);
      const response = await getClassAssignmentsAPI(classId);
      if (Array.isArray(response.data)) setAssignments(response.data);
    } catch (err) {
      console.error("Failed to load assignments:", err);
    } finally {
      setIsAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassroom();
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const handleAssignmentSaved = () => {
    setIsEditorOpen(false);
    fetchAssignments();
  };

  // 🔧 FIXED: was sorting alphabetically by name — now sorts by roll number
  // (rule a: year, rule b: division letter A<B<C, rule c: serial number ascending).
  // The backend's getClassroomDetails already returns students in this order, but
  // sorting again here is cheap defense-in-depth in case that ever changes.
  const sortedStudents = useMemo(() => {
    return [...(classroom?.studentsEnrolled || [])].sort((a, b) =>
      compareRollNumbers(a.rollNumber, b.rollNumber),
    );
  }, [classroom]);

  // 🟢 UPDATED: Builds and downloads an .xlsx gradebook — rows are students sorted
  // by roll number, columns are assignments, and each cell uses the teacher's
  // override when one exists, otherwise the AI-given score. Ungraded/not-submitted
  // cells now show a plain "-" instead of the "Not Submitted" text.
  const handleExportGradebook = async () => {
    setIsExporting(true);
    setExportError("");
    try {
      const res = await getClassGradebookAPI(classId);
      const {
        classroomName,
        students,
        assignments: gbAssignments,
        submissions,
      } = res.data;

      const getScoreForCell = (studentId, assignmentId) => {
        const submission = submissions.find(
          (s) => s.studentId === studentId && s.assignmentId === assignmentId,
        );
        if (!submission) return "-"; // 🔧 FIXED: was "Not Submitted"
        if (
          submission.finalScoreOverride !== null &&
          submission.finalScoreOverride !== undefined
        ) {
          return submission.finalScoreOverride;
        }
        return submission.aiEvaluation?.totalScoreGivenByAI ?? "Pending";
      };

      // 🔧 FIXED: backend already sorts by roll number, but re-sort client-side too
      // for the same defense-in-depth reason as sortedStudents above.
      const sortedForExport = [...students].sort((a, b) =>
        compareRollNumbers(a.rollNumber, b.rollNumber),
      );

      // 🟢 NEW: Roll No is now the first column
      const headerRow = [
        "Roll No",
        "Student Name",
        "Email",
        ...gbAssignments.map((a) => `${a.title} (/${a.totalMarks})`),
      ];

      const dataRows = sortedForExport.map((student) => [
        student.rollNumber || "-",
        student.name,
        student.email,
        ...gbAssignments.map((a) => getScoreForCell(student._id, a._id)),
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Gradebook");

      const safeName = (classroomName || "classroom").replace(/[^\w\-]+/g, "_");
      XLSX.writeFile(workbook, `${safeName}_Gradebook.xlsx`);
    } catch (err) {
      console.error("Failed to export gradebook:", err);
      setExportError(
        err.response?.data?.message || "Could not generate the gradebook.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-sm font-medium text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading classroom...</span>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Classroom not found.
        <button
          onClick={() => navigate("/")}
          className="block mx-auto mt-4 text-indigo-600 font-bold text-xs"
        >
          ‹ Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="text-slate-400 hover:text-indigo-600 font-bold text-lg shrink-0"
        >
          ‹
        </button>
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-sm shrink-0">
          {classroom.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-extrabold text-slate-900 truncate">
            {classroom.name}
          </h2>
          <p className="text-[11px] text-slate-400 font-medium truncate">
            Join code:{" "}
            <span className="font-mono font-bold text-indigo-600">
              {classroom.classCode}
            </span>
          </p>
        </div>
        <button
          onClick={handleExportGradebook}
          disabled={isExporting}
          className="ml-auto shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
        >
          {isExporting ? "Generating..." : "📊 Export Gradebook"}
        </button>
      </div>

      {exportError && (
        <div className="p-2.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded">
          ⚠️ {exportError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-fit">
        <button
          onClick={() => setActiveTab("assignments")}
          className={`flex-1 sm:flex-none text-center px-4 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${
            activeTab === "assignments"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Assignments
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`flex-1 sm:flex-none text-center px-4 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${
            activeTab === "students"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Students ({classroom.studentsEnrolled?.length || 0})
        </button>
      </div>

      {/* Assignments Tab */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsEditorOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-colors"
            >
              + New Assignment
            </button>
          </div>

          {isAssignmentsLoading ? (
            <div className="py-12 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading assignments...</span>
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center space-y-2">
              <span className="text-2xl">📋</span>
              <h4 className="text-sm font-bold text-slate-800">
                No assignments yet
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Create your first assignment to start collecting and grading
                student work.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div
                  key={a._id}
                  onClick={() => navigate(`/teacher/assignment/${a._id}`)}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all shadow-sm cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xl shrink-0">
                      {a.modality === "Speech-Only" ? "🎙️" : "📝"}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {a.title}
                        </h4>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
                          {a.modality}
                        </span>
                        {!a.isResultPublished && (
                          <span className="text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
                            Results Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium">
                        Due{" "}
                        {a.dueDate
                          ? new Date(a.dueDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "No deadline"}{" "}
                        • {a.totalMarks} marks
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
                      {a.submittedCount ?? 0} submitted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Students Tab */}
      {activeTab === "students" && (
        <div className="space-y-3">
          {classroom.studentsEnrolled?.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center space-y-2">
              <span className="text-2xl">🎒</span>
              <h4 className="text-sm font-bold text-slate-800">
                No students enrolled yet
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Share your join code{" "}
                <span className="font-mono font-bold text-indigo-600">
                  {classroom.classCode}
                </span>{" "}
                with students to get started.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-sm">
              {sortedStudents.map((student) => (
                <div
                  key={student._id}
                  className="flex items-center gap-4 p-4 sm:px-6"
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                    {getInitials(student.name, "ST")}
                  </div>
                  <div className="min-w-0">
                    {/* 🟢 NEW: Roll number shown before the name */}
                    <p className="text-sm font-bold text-slate-800 truncate">
                      <span className="font-mono text-indigo-600 mr-1.5">
                        {student.rollNumber || "—"}
                      </span>
                      {student.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {student.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isEditorOpen && (
        <AssignmentEditorModal
          classId={classId}
          onClose={() => setIsEditorOpen(false)}
          onSaved={handleAssignmentSaved}
        />
      )}
    </div>
  );
}

export default ClassDetail;
