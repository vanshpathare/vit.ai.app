import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getClassroomDetailsAPI,
  getClassAssignmentsAPI,
  initializeSubmissionAPI,
} from "../../services/api";

function StudentClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentFilter, setAssignmentFilter] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);

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

  // 🚀 LAUNCHES TEST INTERFACE ENVIRONMENT WITH AUTOMATED LATE-JOINER INITIALIZATION
  const handleViewAssignment = async (assignmentId) => {
    try {
      const response = await initializeSubmissionAPI(assignmentId);
      const targetSubmissionId = response.data.submissionId;
      const modality = response.data.modality || "Text-Only";

      if (modality === "Speech-Only") {
        navigate(`/student/viva-workspace/${targetSubmissionId}`);
      } else {
        navigate(`/student/text-workspace/${targetSubmissionId}`);
      }
    } catch (err) {
      console.error("Failed to launch assignment workspace:", err);
      alert(
        err.response?.data?.message || "Could not launch assignment workspace.",
      );
    }
  };

  const filteredAssignments = assignments.filter((item) => {
    if (assignmentFilter === "completed") {
      return item.status === "submitted" || item.status === "completed";
    }
    return item.status !== "submitted" && item.status !== "completed";
  });

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
            Prof: {classroom.teacherId?.name || "Faculty Coordinator"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-fit">
        <button
          onClick={() => setAssignmentFilter("pending")}
          className={`flex-1 sm:flex-none text-center px-4 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${
            assignmentFilter === "pending"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Pending ({assignments.filter((a) => a.status !== "submitted").length})
        </button>
        <button
          onClick={() => setAssignmentFilter("completed")}
          className={`flex-1 sm:flex-none text-center px-4 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${
            assignmentFilter === "completed"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Completed (
          {assignments.filter((a) => a.status === "submitted").length})
        </button>
      </div>

      {/* Assignment Feed */}
      {isAssignmentsLoading ? (
        <div className="py-16 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Syncing channel feed loops...</span>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center space-y-2">
          <span className="text-2xl select-none">🎉</span>
          <h4 className="text-sm font-bold text-slate-800">
            This feed is clear
          </h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
            No assignments match your active status filters inside this
            workspace.
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredAssignments.map((task) => (
            <div
              key={task._id}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 sm:p-6 flex flex-col gap-4 transition-all shadow-sm"
            >
              {/* Top: icon + title + badges — everything wraps instead of getting clipped */}
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-sm">
                  {task.modality === "Speech-Only" ? "🎙️" : "📝"}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight break-words">
                      {task.title}
                    </h4>
                    {task.status === "ongoing" && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded tracking-wide shrink-0">
                        In Progress
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md tracking-wider uppercase">
                      {task.modality || "Text-Only"}
                    </span>
                    <span className="text-xs sm:text-sm text-slate-500 font-semibold">
                      Marks:{" "}
                      <span className="text-indigo-600 font-bold">
                        {task.totalMarks}
                      </span>
                    </span>
                    <span className="text-xs sm:text-sm text-slate-500 font-semibold capitalize">
                      {task.distributionType?.replace("-", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom: due date + action — stacks cleanly full-width on mobile */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="text-xs sm:text-sm font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg shadow-sm flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  ⏰{" "}
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "No limit"}
                </span>

                <button
                  onClick={() => handleViewAssignment(task._id)}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-base font-bold rounded-lg shadow transition-colors"
                >
                  {task.status === "submitted"
                    ? "View Results"
                    : task.status === "ongoing"
                      ? "Resume Test"
                      : "Start Assignment"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentClassView;
