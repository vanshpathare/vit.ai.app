//TextWorkspace.jsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSubmissionDetailsAPI,
  submitAssignmentAPI,
  logInfractionAPI, // 🟢 Integrated top-level import for clean asynchronous tracking calls
} from "../../services/api";

function TextWorkspace() {
  const { id } = useParams(); // Grabs submissionId from URL parameter trace
  const navigate = useNavigate();
  const [draftAnswers, setDraftAnswers] = useState({});

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🟢 NEW: State layer to handle and render inline server-side submission errors
  const [submitError, setSubmitError] = useState("");

  // 🔒 SECURITY STATE: Track student tab switching metrics natively
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // 📋 Fetch initial platform context metadata
  useEffect(() => {
    const loadWorkspaceData = async () => {
      try {
        setLoading(true);
        const response = await getSubmissionDetailsAPI(id);
        setSubmission(response.data);

        // Inherit any existing tab switch tallies saved from previous sessions
        if (response.data?.tabSwitchCount) {
          setTabSwitchCount(response.data.tabSwitchCount);
        }
      } catch (err) {
        console.error("Workspace loading failure:", err);
        setError(
          err.response?.data?.message || "Failed to sync submission file.",
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) loadWorkspaceData();
  }, [id]);

  // 🟢 Navigate back to this assignment's classroom feed directly (routed page),
  // falling back to the bare dashboard only if the classroom id isn't available.
  const goBackToDashboard = () => {
    const classId =
      submission?.assignmentId?.classId?._id ||
      submission?.classId?._id ||
      null;
    navigate(classId ? `/student/class/${classId}` : "/");
  };

  // 🔒 AIRTIGHT SECURITY EFFECT: Dynamic tracking catching both full tab changes AND floating split windows
  useEffect(() => {
    let lastInfractionTime = 0;

    const handleSecurityBreach = () => {
      if (submission && submission.status !== "submitted") {
        const currentTime = Date.now();

        // 🟢 Throttling Cooldown: Prevents rapid double firing between window blur and tab hide events
        if (currentTime - lastInfractionTime > 1500) {
          lastInfractionTime = currentTime;

          // Update localized interface telemetry state counters instantly
          setTabSwitchCount((prevCount) => prevCount + 1);
          console.warn(
            "⚠️ Security Anomaly: Active viewport focus lost or tab hidden.",
          );

          // 🟢 TAMPER-PROOF: Immediately stream increment signals directly to MongoDB record
          logInfractionAPI(submission._id).catch((err) =>
            console.error(
              "Failed to commit real-time infrastructure flag tracking trace:",
              err,
            ),
          );
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleSecurityBreach();
      }
    };

    const handleWindowBlur = () => {
      handleSecurityBreach();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [submission]);

  // 🔒 SYSTEM SHIELD EFFECT: Deactivates context configurations and shortcuts
  useEffect(() => {
    if (submission && submission.status !== "submitted") {
      // 1. Block right-click context menu (stops paste via mouse options)
      const blockContextMenu = (e) => e.preventDefault();

      // 2. Intercept keyboard shortcuts (Ctrl+V, Cmd+V, Shift+Insert, Inspect element keys)
      const blockShortcuts = (e) => {
        const isPaste =
          (e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "v";
        const isCutCopy =
          (e.ctrlKey || e.metaKey) && ["c", "x"].includes(e.key?.toLowerCase());
        const isInspect =
          e.key === "F12" ||
          ((e.ctrlKey || e.metaKey) &&
            e.shiftKey &&
            ["i", "j", "c"].includes(e.key?.toLowerCase()));

        if (isPaste || isCutCopy || isInspect) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };

      // 3. Poison the clipboard buffer if they select and try to copy your exam text
      const poisonClipboard = (e) => {
        e.clipboardData.setData(
          "text/plain",
          "Security Violation: Clipboard data erased.",
        );
        e.preventDefault();
      };

      document.addEventListener("contextmenu", blockContextMenu);
      document.addEventListener("keydown", blockShortcuts);
      document.addEventListener("copy", poisonClipboard);

      return () => {
        document.removeEventListener("contextmenu", blockContextMenu);
        document.removeEventListener("keydown", blockShortcuts);
        document.removeEventListener("copy", poisonClipboard);
      };
    }
  }, [submission]);

  // 🔒 SECURITY UTILITY: Direct handler to silently prevent shortcut copy/cut/paste commands
  const handleSecurityClipboardIntercept = (e) => {
    if (submission && submission.status !== "submitted") {
      e.preventDefault();
      return false;
    }
  };

  const handleFinalSubmission = async () => {
    try {
      setSubmitError(""); // 🟢 Reset error layout before firing standard pipeline

      // 1. Gather the active questions based on our fallback hierarchy
      const activeQuestions =
        submission.assignedQuestions?.length > 0
          ? submission.assignedQuestions
          : submission.assignmentId?.questionPool || [];

      // 2. Format the responses array layout matching your MongoDB structure
      const formattedResponses = activeQuestions.map((qText, index) => ({
        questionText: qText,
        answerText: draftAnswers[index] || "",
      }));

      // 3. Match the payload layout expected by your backend controller
      const payload = {
        submissionId: submission._id,
        responses: formattedResponses,
      };

      console.log(
        "Submitting secure test answers via Axios pipeline...",
        payload,
      );

      // 4. 🔥 FIRE THE API ENDPOINT: Uses your pre-configured interceptor wrapper
      const response = await submitAssignmentAPI(payload);
      console.log("Evaluation response compiled successfully:", response.data);

      // 5. Force a reload cleanly to lock the workstation view and display the new AI grades and feedback!
      window.location.reload();
    } catch (error) {
      console.error("Failed to execute final test submission script:", error);

      // 🟢 FIXED: Instead of an abstract browser alert window popup, capture message directly to render on canvas
      const errorMsg =
        error.response?.data?.message ||
        "Error saving exam answers. Please check server logs.";
      setSubmitError(errorMsg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-sm font-medium text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Syncing submission matrix...</span>
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
          {error || "Data context dropped."}
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-slate-800 text-white font-semibold text-xs rounded hover:bg-slate-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isSubmitted = submission.status === "submitted";

  // 🟢 NEW: Server-Side Due Date Verification Gatekeeper Check
  const isOverdue =
    !isSubmitted &&
    submission.assignmentId?.dueDate &&
    new Date() > new Date(submission.assignmentId.dueDate);

  // 🛑 UX BLOCK: If overdue, bypass rendering questions/workspace and show a clean locked message card panel
  if (isOverdue) {
    return (
      <div className="w-full min-h-[calc(100vh-4.5rem)] flex items-center justify-center bg-slate-50/50 p-6 select-none">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 border border-amber-100 rounded-full flex items-center justify-center text-2xl mx-auto shadow-sm">
            ⏰
          </div>
          <div className="space-y-1.5 text-center">
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">
              Assignment Locked
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              The evaluation due date has passed. Submissions are no longer
              accepted for this workspace.
            </p>
          </div>
          <button
            onClick={goBackToDashboard}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onCopy={handleSecurityClipboardIntercept}
      onPaste={handleSecurityClipboardIntercept}
      onCut={handleSecurityClipboardIntercept}
      className="w-full min-h-[calc(100vh-4.5rem)] flex flex-col md:flex-row overflow-hidden bg-slate-50/50 text-left select-none"
    >
      {/* 👈 1. LAPTOP/DESKTOP STATIC SIDEBAR COLUMN */}
      {!isSubmitted && (
        <div className="hidden md:flex w-full md:w-[340px] lg:w-[380px] bg-slate-50 border-r border-slate-200 p-6 shrink-0 flex-col justify-between">
          <div className="space-y-4">
            <button
              onClick={goBackToDashboard}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors focus:outline-none"
            >
              <span>‹</span> All teams
            </button>

            <div className="space-y-3 pt-1">
              <div className="w-12 h-12 rounded-lg bg-indigo-600 text-white font-bold text-base flex items-center justify-center select-none shadow-sm">
                {(
                  submission.classId?.name ||
                  submission.assignmentId?.classId?.name ||
                  "CR"
                )
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight break-words">
                  {submission.classId?.name ||
                    submission.assignmentId?.classId?.name ||
                    "Class Workspace"}
                </h2>
              </div>
            </div>

            <div className="pt-4 space-y-2 text-slate-600 text-xs font-medium">
              <div className="px-2.5 py-1.5 bg-slate-200/80 text-indigo-600 font-bold rounded text-center uppercase tracking-wide">
                Docs Exam Environment
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖥️ 2. RIGHT SIDE CORE VIEWPORT CANVAS AREA */}
      <div className="flex-1 p-4 sm:p-8 md:p-10 overflow-y-auto max-w-full">
        {/* 🧭 Top Navigation Header Tracker */}
        <div className="w-full mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            {/* Mobile View Toggle button — always visible when submitted since sidebar is hidden then */}
            <button
              onClick={goBackToDashboard}
              className={`${!isSubmitted ? "md:hidden" : ""} text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 mb-1`}
            >
              ‹ Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              {submission.assignmentId?.title || "Examination Desk"}
            </h1>
          </div>

          <div className="shrink-0">
            {isSubmitted ? (
              <span className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm select-none">
                ✅ Evaluation Completed & Locked
              </span>
            ) : (
              <span className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm select-none">
                ✍️ Session Live
              </span>
            )}
          </div>
        </div>

        {/* 📊 Grid Structure Adjustment Parameters */}
        <div
          className={`w-full grid grid-cols-1 ${isSubmitted ? "lg:grid-cols-3" : "grid-cols-1"} gap-8 items-start`}
        >
          {/* Left Main Lane: Exam Cards Presentation Sheet Area */}
          <div
            className={
              isSubmitted ? "lg:col-span-2 space-y-6" : "w-full space-y-6"
            }
          >
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider">
              Response Details
            </h3>

            {/* 🟢 NEW: Teacher's dos/don'ts, shown only while the student is actively attempting */}
            {submission.assignmentId?.instructions && (
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 flex items-start gap-3">
                <span className="text-xl shrink-0 select-none">📋</span>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-800">
                    Instructions
                  </h4>
                  <p className="text-xs sm:text-sm text-amber-700 whitespace-pre-wrap leading-relaxed">
                    {submission.assignmentId.instructions}
                  </p>
                </div>
              </div>
            )}

            {isSubmitted ? (
              // 📝 VIEW MODE: Displaying previously submitted responses
              submission.responses && submission.responses.length > 0 ? (
                submission.responses.map((item, index) => (
                  <div
                    key={item._id || index}
                    className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm"
                  >
                    <div className="border-b border-slate-100 pb-3">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
                        Question #{index + 1}
                      </span>
                      <h4 className="text-base font-bold text-slate-800 mt-2.5 leading-snug">
                        {item.questionText}
                      </h4>
                    </div>
                    <div className="space-y-1 text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        Your Written Answer:
                      </span>
                      <p className="text-sm text-slate-700 bg-slate-50/70 p-4 border border-slate-100 rounded-lg whitespace-pre-wrap leading-relaxed font-medium">
                        {item.answerText || (
                          <span className="italic text-slate-400">
                            No answer provided.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                submission.assignedQuestions?.map((qText, index) => (
                  <div
                    key={index}
                    className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 shadow-sm"
                  >
                    <h4 className="text-base font-bold text-slate-800">
                      {qText}
                    </h4>
                    <p className="italic text-sm text-slate-400 p-3 bg-slate-50 rounded">
                      Script response data logged without dynamic structured
                      schema fields.
                    </p>
                  </div>
                ))
              )
            ) : (
              // 📝 EDIT MODE: Widescreen typing environment layout
              <div className="space-y-6 w-full">
                {(submission.assignedQuestions &&
                submission.assignedQuestions.length > 0
                  ? submission.assignedQuestions
                  : submission.assignmentId?.questionPool || []
                ).map((qText, index) => (
                  <div
                    key={index}
                    className="w-full bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5 shadow-sm"
                  >
                    <div className="border-b border-slate-100 pb-4">
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded">
                        Question #{index + 1}
                      </span>
                      <h4 className="text-lg font-bold text-slate-800 mt-3 leading-snug">
                        {qText}
                      </h4>
                    </div>

                    <div className="space-y-2 text-left">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                        Type Your Answer:
                      </label>
                      <textarea
                        rows={10}
                        value={draftAnswers[index] || ""}
                        onChange={(e) =>
                          setDraftAnswers({
                            ...draftAnswers,
                            [index]: e.target.value,
                          })
                        }
                        placeholder="Provide your professional detailed response here..."
                        className="w-full text-base text-slate-700 bg-slate-50 focus:bg-white p-5 border border-slate-200 focus:border-indigo-500 rounded-lg shadow-inner outline-none transition-all leading-relaxed font-medium placeholder-slate-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                ))}

                {/* 🟢 NEW: Integrated Canvas Server-Side Time-Out Banner Window */}
                {submitError && (
                  <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-left">
                    <span className="text-xl shrink-0 select-none">⚠️</span>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-red-800">
                        Submission Blocked
                      </h4>
                      <p className="text-xs text-red-600 font-medium leading-relaxed">
                        {submitError}
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Workspace Trigger Controls */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleFinalSubmission}
                    className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer select-none"
                  >
                    Finalize and Submit
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar Lane: AI Performance metrics */}
          {isSubmitted && (
            <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-4">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider">
                Evaluation Metrics
              </h3>

              {/* 📊 1. MARKS WIDGET CONTAINER */}
              {submission.assignmentId?.isResultPublished !== false ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Final Awarded Score
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-4xl font-black text-indigo-600 tracking-tight">
                        {submission.aiEvaluation?.totalScoreGivenByAI ?? "--"}
                      </span>
                      <span className="text-slate-400 font-bold text-sm">
                        / {submission.assignmentId?.totalMarks || 20} Marks
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                // 🔏 BLOCKED MARKS WIDGET FALLBACK
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 text-left">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm shrink-0">
                    🔒
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800">
                      Numerical Grades Pending
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Numerical marks will become visible once officially
                      published by your instructor.
                    </p>
                  </div>
                </div>
              )}

              {/* 🤖 2. AI DIAGNOSTICS FEEDBACK CONTAINER */}
              <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-6 shadow-md space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm tracking-wide">
                  <span>🤖</span>
                  <span>LANG-AI INSIGHT REPORT</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium whitespace-pre-wrap bg-slate-950/40 p-4 rounded-lg border border-slate-800/60 max-h-[320px] overflow-y-auto w-full">
                  {submission.aiEvaluation?.feedback ||
                    "AI diagnostic feedback paragraphs are currently unavailable or processing for this test session."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TextWorkspace;
