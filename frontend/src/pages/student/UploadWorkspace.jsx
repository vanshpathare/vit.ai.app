import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSubmissionDetailsAPI,
  submitAssignmentAPI,
  logInfractionAPI,
  getClassroomDetailsAPI,
} from "../../services/api";
import {
  Video,
  Folder,
  FileText,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import DocxViewerModal from "../../components/DocxViewerModal";
import LiveCameraCapture from "../../components/LiveCameraCapture";

function UploadWorkspace() {
  const { id } = useParams(); // submissionId
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File selection state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [classroomName, setClassroomName] = useState("Classroom Team");

  const isFinished = ["submitted", "queued"].includes(submission?.status);

  // 📋 Fetch submission & assignment context
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const res = await getSubmissionDetailsAPI(id);
        setSubmission(res.data);
        if (res.data?.tabSwitchCount)
          setTabSwitchCount(res.data.tabSwitchCount);

        const classIdRef =
          res.data.assignmentId?.classId?._id || res.data.assignmentId?.classId;
        if (classIdRef) {
          const classRes = await getClassroomDetailsAPI(classIdRef);
          if (classRes.data?.name) {
            setClassroomName(classRes.data.name);
          }
        }
      } catch (err) {
        console.error("Failed to load upload workspace:", err);
        setError(
          err.response?.data?.message || "Failed to sync submission file.",
        );
      } finally {
        setLoading(false);
      }
    };
    if (id) loadWorkspace();
  }, [id]);

  // 🔒 Security & Anti-Cheat: Tab switch listener
  useEffect(() => {
    let lastInfraction = 0;
    const handleBreach = () => {
      if (submission && !isFinished) {
        const now = Date.now();
        if (now - lastInfraction > 1500) {
          lastInfraction = now;
          setTabSwitchCount((prev) => prev + 1);
          logInfractionAPI(submission._id).catch((err) =>
            console.error("Failed to log infraction:", err),
          );
        }
      }
    };
    const handleVisibility = () => {
      if (document.hidden) handleBreach();
    };
    const handleBlur = () => handleBreach();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [submission, isFinished]);

  const goBackToDashboard = () => {
    const classId =
      submission?.assignmentId?.classId?._id ||
      submission?.classId?._id ||
      null;
    navigate(classId ? `/student/class/${classId}` : "/");
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxPages = submission?.assignmentId?.uploadConfig?.maxPages || 5;

    if (selectedFiles.length + files.length > maxPages) {
      alert(`Maximum allowed files/pages is ${maxPages}.`);
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 🚀 Final Submission Execution
  const handleTurnIn = async () => {
    if (selectedFiles.length === 0) {
      alert("Please attach at least one file or document before turning in.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");

      const formData = new FormData();
      formData.append("submissionId", submission._id);
      formData.append("tabSwitchCount", tabSwitchCount);

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await submitAssignmentAPI(formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSubmission(response.data.submission);
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError(
        err.response?.data?.message || "Failed to upload and submit files.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-sm font-medium text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Syncing Teams assignment workspace...</span>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="text-red-500 text-3xl">⚠️</div>
        <h3 className="text-lg font-bold text-slate-800">
          Workspace Sync Error
        </h3>
        <p className="text-sm text-slate-500 bg-red-50 border border-red-100 p-3 rounded">
          {error}
        </p>
        <button
          onClick={goBackToDashboard}
          className="px-4 py-2 bg-slate-800 text-white font-semibold text-xs rounded"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const assignment = submission.assignmentId || {};
  const isOverdue =
    assignment.dueDate && new Date() > new Date(assignment.dueDate);
  const classNameStr = classroomName;
  const allowedFormat =
    assignment.uploadConfig?.allowedUploadType || "handwritten";

  return (
    <div className="w-full min-h-[calc(100vh-4.5rem)] flex flex-col md:flex-row bg-slate-50/50 text-left select-none">
      {/* 👈 LEFT SIDEBAR CHANNEL VIEW (Teams Style) */}
      <div className="hidden md:flex w-full md:w-[320px] bg-slate-50 border-r border-slate-200 p-6 shrink-0 flex-col justify-between">
        <div className="space-y-6">
          <button
            onClick={goBackToDashboard}
            className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
          >
            <span>‹</span> All teams
          </button>

          <div className="space-y-3">
            <div className="w-12 h-12 rounded-lg bg-emerald-600 text-white font-bold text-base flex items-center justify-center shadow-sm">
              {classNameStr.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
                {classNameStr}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Assignments Channel
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-100/80 rounded-xl text-[11px] text-slate-500 font-medium">
          🛡️ Secure Anti-Cheat & Plagiarism Pipeline Active
        </div>
      </div>

      {/* 🖥️ RIGHT MAIN WORKSPACE CANVAS (Teams Assignment View) */}
      <div className="flex-1 p-4 sm:p-8 md:p-10 overflow-y-auto max-w-full">
        {/* Top Header Row */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
          <div className="space-y-1">
            <button
              onClick={goBackToDashboard}
              className="md:hidden text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 mb-1"
            >
              ‹ Back
            </button>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                🎒
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {assignment.title || "Assignment"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                Points
              </span>
              <span className="text-sm font-extrabold text-slate-800">
                {assignment.totalMarks || 10} points possible
              </span>
            </div>

            {!isFinished && !isOverdue && (
              <button
                onClick={handleTurnIn}
                disabled={isSubmitting || selectedFiles.length === 0}
                className={`px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow transition-all ${
                  isSubmitting ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                {isSubmitting
                  ? "Uploading..."
                  : isOverdue
                    ? "Turn in late"
                    : "Turn in"}
              </button>
            )}

            {isFinished && (
              <span className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Turned In
              </span>
            )}
          </div>
        </div>

        {/* Due Date & Rules Banner */}
        <div className="text-xs font-semibold text-slate-500 mb-6 flex flex-wrap items-center gap-4">
          <span>
            Due{" "}
            {assignment.dueDate
              ? new Date(assignment.dueDate).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "No limit"}
          </span>
          <span>•</span>
          <span>
            {assignment.allowMultipleSubmissions
              ? "Multiple submissions allowed"
              : "Single submission"}
          </span>
        </div>

        {/* Instructions Section */}
        {assignment.instructions && (
          <div className="space-y-2 mb-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Instructions
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
              {assignment.instructions}
            </div>
          </div>
        )}

        {/* Reference Materials (Teacher attachments) */}
        {assignment.attachments && assignment.attachments.length > 0 && (
          <div className="space-y-3 mb-8">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Reference materials
            </h3>
            <div className="space-y-2">
              {assignment.attachments.map((att, idx) => (
                <div
                  key={att._id || idx}
                  onClick={() => {
                    if (att.url?.endsWith(".docx") || att.fileType === "docx") {
                      setPreviewDoc({
                        url: att.url,
                        title: att.fileName || att.title,
                      });
                    } else {
                      window.open(att.url, "_blank");
                    }
                  }}
                  className="flex items-center justify-between p-3.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl cursor-pointer transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                      {att.fileName || att.title || "Reference Document"}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 shrink-0 ml-2">
                    Open ↗
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {assignment.questionPool && assignment.questionPool.length > 0 && (
          <div className="space-y-2 mb-6">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Assignment Questions / Tasks
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-700 space-y-2 shadow-sm">
              {assignment.questionPool.map((q, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-indigo-600 shrink-0">
                    {idx + 1}.
                  </span>
                  <p className="leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Work Section */}
        <div className="space-y-4 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              My work
            </h3>
            <span className="text-xs text-slate-700 font-medium">
              Max pages allowed: {assignment.uploadConfig?.maxPages || 5}
            </span>
          </div>

          {/* If already submitted, show submitted files */}
          {isFinished && submission.uploadedFiles?.length > 0 ? (
            <div className="space-y-2">
              {submission.uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {file.fileName || `Page ${file.pageNumber}`}
                      </p>
                      <span className="text-[11px] text-slate-400 uppercase">
                        {file.fileType}
                      </span>
                    </div>
                  </div>
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    View File ↗
                  </a>
                </div>
              ))}

              {/* AI Feedback / Grading Display */}
              {submission.aiEvaluation?.feedback && (
                <div className="mt-6 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-6 shadow-md space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    <span>🤖</span> <span>AssignBuddy EVALUATION REPORT</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-950/40 p-4 rounded-lg border border-slate-800/60">
                    {submission.aiEvaluation.feedback}
                  </p>
                  <div className="pt-2 text-sm font-bold text-indigo-300">
                    Score Awarded:{" "}
                    {submission.aiEvaluation.totalScoreGivenByAI ?? "--"} /{" "}
                    {assignment.totalMarks || 10}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Upload Dropzone & Selected Files / Live Camera
            <div className="space-y-4">
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                  {submitError}
                </div>
              )}

              {/* 🟢 CONDITIONAL RENDERING: Live Camera Component vs Standard File Picker */}
              {allowedFormat === "handwritten" || allowedFormat === "image" ? (
                <LiveCameraCapture
                  onCapture={(files) => setSelectedFiles(files)}
                  maxPages={assignment.uploadConfig?.maxPages || 5}
                />
              ) : (
                <>
                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-slate-400 hover:text-red-600 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Standard PDF / Document Upload Trigger */}
                  <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/30 rounded-2xl cursor-pointer transition-all shadow-sm group">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Attach document files
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Upload scanned PDF documents of your work
                    </p>
                    <input
                      type="file"
                      multiple
                      accept="application/pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleTurnIn}
                  disabled={isSubmitting || selectedFiles.length === 0}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer"
                >
                  {isSubmitting
                    ? "Uploading & Evaluating..."
                    : "Turn in Assignment 🚀"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {previewDoc && (
        <DocxViewerModal
          fileUrl={previewDoc.url}
          title={previewDoc.title}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

export default UploadWorkspace;
