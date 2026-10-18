import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getAssignmentByIdAPI,
  getClassroomDetailsAPI,
  getAssignmentSubmissionsAPI,
  toggleResultPublishAPI,
  reevaluateSubmissionAPI,
  reevaluateStuckSubmissionsAPI,
  reevaluateQueuedUploadsAPI,
} from "../../services/api";
import AssignmentEditorModal from "../../components/teacher/AssignmentEditorModal";
import SubmissionDetailModal from "../../components/teacher/SubmissionDetailModal"; // 🟢 Dedicated modal component import
import { getInitials } from "../../utils/getInitials";
import { compareRollNumbers } from "../../utils/rollNumberSort";
import {
  Video,
  Folder,
  FileText,
  ShieldAlert,
  AlertTriangle,
  Users,
  Monitor,
  Cpu,
} from "lucide-react";

const getAttachmentIcon = (fileType, url) => {
  if (
    fileType === "youtube" ||
    url?.includes("youtube") ||
    url?.includes("youtu.be")
  ) {
    return <Video className="w-3.5 h-3.5 text-red-600 shrink-0" />;
  }
  if (fileType === "drive" || url?.includes("drive.google.com")) {
    return <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
  return <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
};

function UploadSubmissionTracker() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [roster, setRoster] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🟢 Dedicated Upload Filters
  const [filter, setFilter] = useState("all"); // all | submitted | not_submitted | queued | same_content | same_upload | screen_image | ai_handwriting

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [requeueingId, setRequeueingId] = useState(null);
  const [isBulkRequeueing, setIsBulkRequeueing] = useState(false);

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
      console.error("Failed to load upload tracker data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const refreshSubmissions = async () => {
    try {
      const res = await getAssignmentSubmissionsAPI(assignmentId);
      setSubmissions(res.data || []);
    } catch (err) {
      console.warn("Silent refresh failed:", err.message);
    }
  };

  const hasQueued = submissions.some((s) => s.status === "queued");

  useEffect(() => {
    if (!hasQueued) return;
    const timer = setInterval(refreshSubmissions, 15000);
    return () => clearInterval(timer);
  }, [hasQueued, assignmentId]);

  const handleEvaluateOne = async (submissionId) => {
    setRequeueingId(submissionId);
    try {
      await reevaluateSubmissionAPI(submissionId);
      await refreshSubmissions();
    } catch (err) {
      alert(err.response?.data?.message || "Could not re-send for evaluation.");
    } finally {
      setRequeueingId(null);
    }
  };

  const handleEvaluateStuck = async () => {
    setIsBulkRequeueing(true);
    try {
      const res = await reevaluateQueuedUploadsAPI(assignmentId);
      alert(res.data?.message || "Done.");
      await refreshSubmissions();
    } catch (err) {
      alert(
        err.response?.data?.message || "Could not re-send stuck submissions.",
      );
    } finally {
      setIsBulkRequeueing(false);
    }
  };

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

  const sortedRoster = [...roster].sort((a, b) =>
    compareRollNumbers(a.rollNumber, b.rollNumber),
  );

  const mergedRows = sortedRoster.map((student) => {
    const submission = submissions.find(
      (s) => s.studentId?._id === student._id,
    );
    return { student, submission };
  });

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

  // 📊 Metrics calculations for Upload Assignments
  const submittedCount = mergedRows.filter(
    ({ submission }) => submission?.status === "submitted",
  ).length;
  const queuedCount = mergedRows.filter(
    ({ submission }) => submission?.status === "queued",
  ).length;
  const notSubmittedCount = mergedRows.filter(
    ({ submission }) =>
      !submission || !["submitted", "queued"].includes(submission.status),
  ).length;

  const sameContentCount = submissions.filter((s) => s.isTextPlagiarism).length;
  const sameUploadCount = submissions.filter(
    (s) => s.isVisualPlagiarism,
  ).length;
  const screenImageCount = submissions.filter((s) =>
    s.aiEvaluation?.feedback?.includes("Screen Capture"),
  ).length;
  const aiHandwritingCount = submissions.filter((s) =>
    s.aiEvaluation?.feedback?.includes("Text-to-Handwriting"),
  ).length;

  // 🔍 Filter logic
  const filteredRows = mergedRows.filter(({ submission }) => {
    if (filter === "submitted") return submission?.status === "submitted";
    if (filter === "not_submitted")
      return (
        !submission || !["submitted", "queued"].includes(submission.status)
      );
    if (filter === "queued") return submission?.status === "queued";
    if (filter === "same_content") return submission?.isTextPlagiarism;
    if (filter === "same_upload") return submission?.isVisualPlagiarism;
    if (filter === "screen_image")
      return submission?.aiEvaluation?.feedback?.includes("Screen Capture");
    if (filter === "ai_handwriting")
      return submission?.aiEvaluation?.feedback?.includes(
        "Text-to-Handwriting",
      );
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-sm font-medium text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading upload assignment tracker...</span>
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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() =>
              navigate(
                `/teacher/class/${assignment.classId?._id || assignment.classId}`,
              )
            }
            className="text-slate-400 hover:text-orange-600 font-bold text-lg shrink-0 mt-0.5 cursor-pointer"
          >
            ‹
          </button>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 truncate">
                {assignment.title}
              </h2>
              <span className="text-[10px] font-black bg-orange-50 text-orange-600 border border-orange-100 px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                Upload & Forensic Modality
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
              - {assignment.totalMarks} marks •{" "}
              {assignment.assignmentCode && (
                <span className="font-mono text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-100 ml-1">
                  Code: {assignment.assignmentCode}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={handleTogglePublish}
            disabled={isPublishing}
            className={`flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors border cursor-pointer ${
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
            className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Edit Settings
          </button>
        </div>
      </div>

      {/* 📊 FORENSIC & PLAGIARISM METRICS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Same Upload
            </span>
            <span className="text-xl font-extrabold text-slate-900">
              {sameUploadCount}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Same Content
            </span>
            <span className="text-xl font-extrabold text-slate-900">
              {sameContentCount}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Screen Images
            </span>
            <span className="text-xl font-extrabold text-slate-900">
              {screenImageCount}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              AI Handwriting
            </span>
            <span className="text-xl font-extrabold text-slate-900">
              {aiHandwritingCount}
            </span>
          </div>
        </div>
      </div>

      {/* 🎛️ CUSTOM UPLOAD FILTERS TRAY */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full overflow-x-auto scrollbar-none">
        {[
          { key: "all", label: `All (${mergedRows.length})` },
          { key: "submitted", label: `Submitted (${submittedCount})` },
          {
            key: "not_submitted",
            label: `Not Submitted (${notSubmittedCount})`,
          },
          { key: "queued", label: `Queued (${queuedCount})` },
          {
            key: "same_content",
            label: `👥 Same Content (${sameContentCount})`,
          },
          { key: "same_upload", label: `📄 Same Upload (${sameUploadCount})` },
          {
            key: "screen_image",
            label: `💻 Screen Image (${screenImageCount})`,
          },
          {
            key: "ai_handwriting",
            label: `🤖 AI Handwriting (${aiHandwritingCount})`,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              filter === tab.key
                ? "bg-white text-orange-600 shadow-sm"
                : "text-slate-500 hover:text-orange-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {queuedCount > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <p className="text-xs sm:text-sm font-semibold text-orange-900">
            ⏳ {queuedCount} upload submission(s) waiting for AI evaluation &
            cross-division checks.
          </p>
          <button
            onClick={handleEvaluateStuck}
            disabled={isBulkRequeueing}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
          >
            {isBulkRequeueing ? "Evaluating..." : "Evaluate all queued"}
          </button>
        </div>
      )}

      {/* Student Rows */}
      <div className="space-y-2.5">
        {filteredRows.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center text-sm text-slate-400">
            No submissions match this filter.
          </div>
        ) : (
          filteredRows.map(({ student, submission }) => {
            const isSubmitted = submission?.status === "submitted";
            const isQueued = submission?.status === "queued";
            const isSameUpload = submission?.isVisualPlagiarism;
            const isSameContent = submission?.isTextPlagiarism;
            const isScreen =
              submission?.aiEvaluation?.feedback?.includes("Screen Capture");
            const isAIHand = submission?.aiEvaluation?.feedback?.includes(
              "Text-to-Handwriting",
            );

            return (
              <div
                key={student._id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 sm:px-5 transition-colors ${
                  isSameUpload || isSameContent || isScreen || isAIHand
                    ? "bg-red-50/80 border-red-200 shadow-sm"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                    {getInitials(student.name, "ST")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      <span className="font-mono text-orange-600 mr-1.5">
                        {student.rollNumber || "—"}
                      </span>
                      {student.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {student.email}
                    </p>

                    {/* Forensic & Plagiarism Warning Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {isSameUpload && (
                        <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded">
                          🚨 Same Upload (Friend's Copy)
                        </span>
                      )}
                      {isSameContent && (
                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          👥 Same Content
                        </span>
                      )}
                      {isScreen && (
                        <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          💻 Screen Image
                        </span>
                      )}
                      {isAIHand && (
                        <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          🤖 AI Generated Handwriting
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap sm:justify-end">
                  {isSubmitted &&
                    (() => {
                      const score = getDisplayScore(submission);
                      if (!score) return null;
                      return (
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wide ${score.isOverride ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"}`}
                        >
                          {score.isOverride ? "✍️ Override: " : "🤖 AI: "}
                          {score.value}/{assignment.totalMarks}
                        </span>
                      );
                    })()}

                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wide ${isSubmitted ? "bg-emerald-100 text-emerald-700" : isQueued ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {isSubmitted
                      ? "Submitted"
                      : isQueued
                        ? "Queued"
                        : "Not Submitted"}
                  </span>

                  {(isSubmitted || isQueued) && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await handleEvaluateOne(submission._id);
                            alert("AI evaluation completed successfully!");
                            loadData();
                          } catch (err) {
                            alert(
                              err.response?.data?.message ||
                                "Failed to run AI evaluation.",
                            );
                          }
                        }}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                      >
                        Run AI Evaluation 🤖
                      </button>

                      <button
                        onClick={() => setSelectedSubmissionId(submission._id)}
                        className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                      >
                        Review Work
                      </button>
                    </div>
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

export default UploadSubmissionTracker;
