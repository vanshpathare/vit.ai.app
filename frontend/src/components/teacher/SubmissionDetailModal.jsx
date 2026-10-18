import React, { useState, useEffect } from "react";
import {
  getSubmissionDetailsAPI,
  overrideSubmissionScoreAPI,
} from "../../services/api";

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
  const [activeFilePreview, setActiveFilePreview] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await getSubmissionDetailsAPI(submissionId);
        console.log("🔍 Loaded Upload Submission Details:", res.data);
        setSubmission(res.data);
        setOverrideValue(
          res.data.finalScoreOverride ??
            res.data.aiEvaluation?.totalScoreGivenByAI ??
            "",
        );
        if (res.data.uploadedFiles && res.data.uploadedFiles.length > 0) {
          setActiveFilePreview(res.data.uploadedFiles[0]);
        }
      } catch (err) {
        console.error("Failed to load detail:", err);
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
      setOverrideMsg(
        `⚠️ ${err.response?.data?.message || "Failed to save override."}`,
      );
    } finally {
      setIsSavingOverride(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="bg-white border border-slate-200 w-full max-w-5xl max-h-[95vh] rounded-xl shadow-2xl relative z-10 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {submission?.studentId?.name || "Student"} — Upload Forensic
              Review
            </h3>
            <p className="text-xs text-slate-400">
              {submission?.studentId?.email} • Roll:{" "}
              {submission?.studentId?.rollNumber || "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-semibold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading || !submission ? (
            <div className="col-span-2 py-16 text-center text-xs font-medium text-slate-400">
              Loading submission workspace...
            </div>
          ) : (
            <>
              {/* LEFT COLUMN: Inline File Viewer */}
              <div className="space-y-4 flex flex-col">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Submitted Pages / Files (
                  {submission.uploadedFiles?.length || 0})
                </h4>

                {/* File Tabs / Selector */}
                {submission.uploadedFiles &&
                submission.uploadedFiles.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {submission.uploadedFiles.map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveFilePreview(file)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          activeFilePreview?.fileUrl === file.fileUrl
                            ? "bg-orange-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        Page {file.pageNumber || idx + 1}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-red-500 font-semibold">
                    ⚠️ No files found in submission record.
                  </p>
                )}

                {/* Active File Inline Preview Box */}
                <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 min-h-[400px] flex items-center justify-center p-2 relative">
                  {activeFilePreview ? (
                    activeFilePreview.fileType === "pdf" ||
                    activeFilePreview.fileName?.endsWith(".pdf") ? (
                      <iframe
                        src={activeFilePreview.fileUrl}
                        title="PDF Viewer"
                        className="w-full h-[450px] rounded-lg border-0 bg-white"
                      />
                    ) : (
                      <img
                        src={activeFilePreview.fileUrl}
                        alt="Student Submission Page"
                        className="max-h-[450px] w-full object-contain rounded-lg shadow-md"
                      />
                    )
                  ) : (
                    <p className="text-xs text-slate-400">
                      Select a page to preview.
                    </p>
                  )}
                </div>

                {activeFilePreview && (
                  <div className="text-right">
                    <a
                      href={activeFilePreview.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-orange-600 hover:underline"
                    >
                      Open Full Size in New Tab ↗
                    </a>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: AI Report & Manual Grading */}
              <div className="space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                  {/* AI & Forensic Report */}
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-5 space-y-2 shadow-md">
                    <p className="text-orange-400 font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                      <span>🤖</span> AI Forensic & Evaluation Report
                    </p>
                    <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 max-h-[220px] overflow-y-auto">
                      {submission.aiEvaluation?.feedback ||
                        "No feedback recorded yet. Click 'Run AI Evaluation' on the dashboard."}
                    </p>
                  </div>

                  {/* Manual Override */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                    <p className="text-sm font-bold text-slate-800">
                      Manual Score Override
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={overrideValue}
                        onChange={(e) => setOverrideValue(e.target.value)}
                        placeholder={`out of ${totalMarks}`}
                        className="w-32 h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-orange-600 focus:outline-none"
                      />
                      <button
                        onClick={handleSaveOverride}
                        disabled={isSavingOverride}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                      >
                        {isSavingOverride ? "Saving..." : "Save Override"}
                      </button>
                      {overrideMsg && (
                        <span className="text-xs font-semibold text-emerald-600">
                          {overrideMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubmissionDetailModal;
