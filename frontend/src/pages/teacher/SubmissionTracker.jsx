import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getAssignmentByIdAPI,
  getClassroomDetailsAPI,
  getAssignmentSubmissionsAPI,
  getSubmissionDetailsAPI,
  overrideSubmissionScoreAPI,
  toggleResultPublishAPI,
} from "../../services/api";
import AssignmentEditorModal from "../../components/teacher/AssignmentEditorModal";
import { getInitials } from "../../utils/getInitials"; // 🟢 NEW: proper first+last initials for student avatars

function SubmissionTracker() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [roster, setRoster] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | submitted | pending
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const assignmentRes = await getAssignmentByIdAPI(assignmentId);
      setAssignment(assignmentRes.data);

      const classId =
        assignmentRes.data.classId?._id || assignmentRes.data.classId;

      const [classroomRes, submissionsRes] = await Promise.all([
        getClassroomDetailsAPI(classId),
        getAssignmentSubmissionsAPI(assignmentId),
      ]);

      setRoster(classroomRes.data.studentsEnrolled || []);
      setSubmissions(submissionsRes.data || []);
    } catch (err) {
      console.error("Failed to load submission tracker data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const handleTogglePublish = async () => {
    setIsPublishing(true);
    try {
      await toggleResultPublishAPI(assignmentId, !assignment.isResultPublished);
      await loadData();
    } catch (err) {
      console.error("Failed to toggle publish state:", err);
    } finally {
      setIsPublishing(false);
    }
  };

  // 🟢 NEW: Sort the roster alphabetically by name before merging in submission data
  const sortedRoster = [...roster].sort((a, b) =>
    (a.name || "").localeCompare(b.name || ""),
  );

  const mergedRows = sortedRoster.map((student) => {
    const submission = submissions.find(
      (s) => s.studentId?._id === student._id,
    );
    return { student, submission };
  });

  // 🟢 NEW: Resolves the score to display inline on a row — the teacher's manual
  // override when one exists, otherwise the AI-given score.
  const getDisplayScore = (submission) => {
    if (!submission) return null;
    if (
      submission.finalScoreOverride !== null &&
      submission.finalScoreOverride !== undefined
    ) {
      return { value: submission.finalScoreOverride, isOverride: true };
    }
    if (submission.aiEvaluation?.totalScoreGivenByAI !== undefined) {
      return {
        value: submission.aiEvaluation.totalScoreGivenByAI,
        isOverride: false,
      };
    }
    return null;
  };

  const filteredRows = mergedRows.filter(({ submission }) => {
    if (filter === "submitted")
      return Boolean(submission && submission.status === "submitted");
    if (filter === "pending")
      return !submission || submission.status !== "submitted";
    return true;
  });

  const submittedCount = mergedRows.filter(
    ({ submission }) => submission?.status === "submitted",
  ).length;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-sm font-medium text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading assignment data...</span>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Assignment not found.
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() =>
              navigate(
                `/teacher/class/${assignment.classId?._id || assignment.classId}`,
              )
            }
            className="text-slate-400 hover:text-indigo-600 font-bold text-lg shrink-0 mt-0.5"
          >
            ‹
          </button>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 truncate">
                {assignment.title}
              </h2>
              <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
                {assignment.modality}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Due{" "}
              {new Date(assignment.dueDate).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              • {assignment.totalMarks} marks •{" "}
              {assignment.allowMultipleSubmissions
                ? "Multiple attempts allowed"
                : "Single attempt only"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={handleTogglePublish}
            disabled={isPublishing}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors border ${
              assignment.isResultPublished
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            }`}
          >
            {assignment.isResultPublished
              ? "✅ Results Published"
              : "🔒 Results Hidden"}
          </button>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            Edit Settings
          </button>
        </div>
      </div>

      {/* Question Pool Preview */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-3 shadow-sm">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
          Question Pool ({assignment.questionPool?.length || 0})
          {assignment.distributionType === "random" &&
            ` • ${assignment.questionsPerStudent} per student, randomized`}
        </h3>
        <div className="space-y-2">
          {assignment.questionPool?.map((q, idx) => (
            <p
              key={idx}
              className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5"
            >
              <span className="font-bold text-indigo-600 mr-2">{idx + 1}.</span>
              {q}
            </p>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-fit">
        {[
          { key: "all", label: `All (${mergedRows.length})` },
          { key: "submitted", label: `Submitted (${submittedCount})` },
          {
            key: "pending",
            label: `Not Submitted (${mergedRows.length - submittedCount})`,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 sm:flex-none text-center px-4 py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${
              filter === tab.key
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Student Rows */}
      <div className="space-y-2.5">
        {filteredRows.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center text-sm text-slate-400">
            No students match this filter.
          </div>
        ) : (
          filteredRows.map(({ student, submission }) => {
            const hasFlags = submission?.tabSwitchCount > 0;
            const isSubmitted = submission?.status === "submitted";
            return (
              <div
                key={student._id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 sm:px-5 transition-colors ${
                  hasFlags
                    ? "bg-red-50/70 border-red-200"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                    {getInitials(student.name, "ST")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {student.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {student.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap sm:justify-end">
                  {isSubmitted &&
                    (() => {
                      const score = getDisplayScore(submission);
                      if (!score) return null;
                      return (
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wide ${
                            score.isOverride
                              ? "bg-amber-100 text-amber-700"
                              : "bg-indigo-100 text-indigo-700"
                          }`}
                        >
                          {score.isOverride ? "✍️ Override: " : "🤖 AI: "}
                          {score.value}/{assignment.totalMarks}
                        </span>
                      );
                    })()}

                  {hasFlags && (
                    <span className="text-[10px] font-black bg-red-100 text-red-700 px-2.5 py-1 rounded uppercase tracking-wide">
                      ⚠️ {submission.tabSwitchCount} tab switches
                    </span>
                  )}

                  {submission?.status === "ongoing" && (
                    <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2.5 py-1 rounded uppercase tracking-wide">
                      In Progress
                    </span>
                  )}

                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wide ${
                      isSubmitted
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isSubmitted ? "Submitted" : "Not Submitted"}
                  </span>

                  {isSubmitted && (
                    <button
                      onClick={() => setSelectedSubmissionId(submission._id)}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
                    >
                      Check
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {isEditorOpen && (
        <AssignmentEditorModal
          classId={assignment.classId?._id || assignment.classId}
          existingAssignment={assignment}
          onClose={() => setIsEditorOpen(false)}
          onSaved={() => {
            setIsEditorOpen(false);
            loadData();
          }}
        />
      )}

      {selectedSubmissionId && (
        <SubmissionDetailModal
          submissionId={selectedSubmissionId}
          totalMarks={assignment.totalMarks}
          onClose={() => setSelectedSubmissionId(null)}
          onOverrideSaved={loadData}
        />
      )}
    </div>
  );
}

// 🔍 DETAIL MODAL: Full question/answer breakdown, AI scores, and manual override
function SubmissionDetailModal({
  submissionId,
  totalMarks,
  onClose,
  onOverrideSaved,
}) {
  const [submission, setSubmission] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [overrideValue, setOverrideValue] = useState("");
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await getSubmissionDetailsAPI(submissionId);
        setSubmission(res.data);
        setOverrideValue(
          res.data.finalScoreOverride ??
            res.data.aiEvaluation?.totalScoreGivenByAI ??
            "",
        );
      } catch (err) {
        console.error("Failed to load submission detail:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [submissionId]);

  const handleSaveOverride = async () => {
    setIsSavingOverride(true);
    setOverrideMsg("");
    try {
      await overrideSubmissionScoreAPI(
        submissionId,
        overrideValue === "" ? null : parseFloat(overrideValue),
      );
      setOverrideMsg("Score updated successfully.");
      onOverrideSaved?.();
    } catch (err) {
      setOverrideMsg("Failed to save override.");
    } finally {
      setIsSavingOverride(false);
    }
  };

  const scoresEntries = submission?.aiEvaluation?.scores
    ? Object.entries(submission.aiEvaluation.scores)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="bg-white border border-slate-200 w-full max-w-3xl max-h-[95vh] rounded-xl shadow-2xl relative z-10 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {submission?.studentId?.name || "Student"} — Submission Review
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {submission?.studentId?.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-semibold text-lg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {isLoading || !submission ? (
            <div className="py-16 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading submission...</span>
            </div>
          ) : (
            <>
              {/* Meta strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Status
                  </p>
                  <p className="text-sm font-bold text-slate-800 capitalize">
                    {submission.status}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Tab Switches
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      submission.tabSwitchCount > 0
                        ? "text-red-600"
                        : "text-slate-800"
                    }`}
                  >
                    {submission.tabSwitchCount}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    AI Score
                  </p>
                  <p className="text-sm font-bold text-indigo-600">
                    {submission.aiEvaluation?.totalScoreGivenByAI ?? "--"} /{" "}
                    {totalMarks}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Submitted
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {submission.submittedAt
                      ? new Date(submission.submittedAt).toLocaleDateString(
                          "en-IN",
                          { day: "2-digit", month: "short" },
                        )
                      : "--"}
                  </p>
                </div>
              </div>

              {/* Question / Answer breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Responses
                </h4>
                {submission.responses?.length > 0 ? (
                  submission.responses.map((r, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2"
                    >
                      <p className="text-sm font-bold text-slate-800">
                        Q{idx + 1}. {r.questionText}
                      </p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap bg-white border border-slate-100 rounded p-3">
                        {r.answerText || (
                          <span className="italic text-slate-400">
                            No answer provided.
                          </span>
                        )}
                      </p>
                    </div>
                  ))
                ) : submission.conversationHistory?.length > 0 ? (
                  submission.conversationHistory.map((turn, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg p-3 text-sm ${
                        turn.role === "interviewer"
                          ? "bg-indigo-50 text-indigo-800 border border-indigo-100"
                          : "bg-slate-50 text-slate-700 border border-slate-200 ml-4"
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wide block mb-1 opacity-60">
                        {turn.role === "interviewer"
                          ? "AI Interviewer"
                          : "Student"}
                      </span>
                      {turn.text}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No response data recorded.
                  </p>
                )}
              </div>

              {/* Score breakdown */}
              {scoresEntries.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    AI Score Breakdown
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200">
                    {scoresEntries.map(([key, val]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <span className="text-slate-600 font-medium">
                          {key}
                        </span>
                        <span className="font-bold text-slate-800">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div className="bg-slate-900 text-slate-100 rounded-xl p-5 space-y-2">
                <p className="text-indigo-400 font-bold text-xs uppercase tracking-wide">
                  🤖 AI Feedback
                </p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {submission.aiEvaluation?.feedback || "No feedback recorded."}
                </p>
              </div>

              {/* Manual override */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-bold text-slate-800">
                  Manual Score Override
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="number"
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    placeholder={`out of ${totalMarks}`}
                    className="w-32 h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveOverride}
                    disabled={isSavingOverride}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    {isSavingOverride ? "Saving..." : "Save Override"}
                  </button>
                  {overrideMsg && (
                    <span className="text-xs font-semibold text-emerald-600">
                      {overrideMsg}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Students see this value in place of the AI score, shown
                  seamlessly as their final mark.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubmissionTracker;
