//VivaWorkspace.jsx

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSubmissionDetailsAPI,
  submitAssignmentAPI,
  logInfractionAPI, // 🟢 Integrated top-level import for clean asynchronous tracking calls
} from "../../services/api";

function VivaWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Core Platform Data States
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🟢 NEW: State layer to handle and render inline server-side submission timeline errors
  const [submitError, setSubmitError] = useState("");

  // Media Capture & Conversational State Tracking
  const [isRoomActive, setIsRoomActive] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);

  // 🔒 SECURITY STATE: Track student tab switching metrics natively
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // References
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const activeStreamRef = useRef(null);

  // 🔊 Text-to-Speech Synthesizer Interface Engine
  const speakQuestionToStudent = (textToSpeak) => {
    if (!textToSpeak || textToSpeak === "CONVERSATION_COMPLETE") return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.includes("en-US") || v.lang.includes("en-GB"),
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
  };

  // 📋 Fetch initial platform context metadata
  useEffect(() => {
    const fetchVivaContext = async () => {
      try {
        setLoading(true);
        const response = await getSubmissionDetailsAPI(id);
        setSubmission(response.data);

        // Inherit any existing tab switch tallies saved from previous rounds
        if (response.data?.tabSwitchCount) {
          setTabSwitchCount(response.data.tabSwitchCount);
        }
      } catch (err) {
        console.error(
          "Failed to fetch conversational workspace context mapping:",
          err,
        );
        setError(
          err.response?.data?.message ||
            "Failed to initialize conversational audio matrix.",
        );
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchVivaContext();
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

  // ⏱️ Recording Duration Clock Tracker
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

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

          // 🟢 TAMPER-PROOF: Immediately stream infraction logs directly to MongoDB record
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

  // 🔒 SYSTEM SHIELD EFFECT: Deactivates right-clicks and copy/cut shortcuts completely
  useEffect(() => {
    if (submission && submission.status !== "submitted") {
      const blockContextMenu = (e) => e.preventDefault();
      const blockShortcuts = (e) => {
        const isPaste =
          (e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "v";
        const isCutCopy =
          (e.ctrlKey || e.metaKey) && ["c", "x"].includes(e.key?.toLowerCase());

        if (isPaste || isCutCopy) {
          e.preventDefault();
          return false;
        }
      };

      document.addEventListener("contextmenu", blockContextMenu);
      document.addEventListener("keydown", blockShortcuts);
      return () => {
        document.removeEventListener("contextmenu", blockContextMenu);
        document.removeEventListener("keydown", blockShortcuts);
      };
    }
  }, [submission]);

  // General fallback cleanup effect on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 🔒 SECURITY UTILITY: Direct handler to silently prevent shortcut copy/cut/paste commands
  const handleSecurityClipboardIntercept = (e) => {
    if (!isSubmitted) {
      e.preventDefault();
      return false;
    }
  };

  // 🚪 ENTER ROOM AND LISTEN TO THE FIRST QUESTION
  const enterRoom = () => {
    setIsRoomActive(true);
    setIsAiResponding(true);
    speakQuestionToStudent(targetQuestion);
    setTimeout(() => setIsAiResponding(false), 3500);
  };

  // 🎙️ START RECORDING (MANUAL TRIGGER)
  const startRecordingAnswer = async () => {
    try {
      audioChunksRef.current = [];
      setAudioBlob(null);
      setAudioUrl("");
      setRecordingDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      setIsRecording(true);
      monitorMicFrequencies();

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.start();
    } catch (err) {
      console.error("Microphone hardware configuration layout blocked:", err);
      alert(
        "Microphone connection failed. Please check your peripheral device options.",
      );
    }
  };

  // 🛑 STOP RECORDING (MANUAL TRIGGER)
  const stopRecordingAnswer = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const compiledBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setAudioBlob(compiledBlob);
        setAudioUrl(URL.createObjectURL(compiledBlob));

        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsUserSpeaking(false);
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    }
  };

  // 📊 Live decibel threshold monitor loop
  const monitorMicFrequencies = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const checkVolume = () => {
      if (!analyserRef.current || !isRecording) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const averageVolume =
        dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setIsUserSpeaking(averageVolume > 15);
      animationFrameRef.current = requestAnimationFrame(checkVolume);
    };
    checkVolume();
  };

  // 🚀 SUBMIT CAPTURED RESPONSE Snippet TO AI ENDPOINT WITH METRICS CORRELATION
  const handleTurnSubmission = async () => {
    if (!audioBlob)
      return alert("Please record your statement answer before submitting.");

    try {
      setIsFinishing(true);
      setSubmitError(""); // 🟢 Clear previous error flags before refiring stream payloads

      const formData = new FormData();
      formData.append("submissionId", id);
      formData.append("audio", audioBlob, `viva_turn_${Date.now()}.webm`);

      console.log(
        `Submitting recorded audio segment context payload. Volume size: ${audioBlob.size} bytes.`,
      );

      const response = await submitAssignmentAPI(formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const {
        status,
        nextQuestionToSpeak,
        submission: updatedSubmission,
      } = response.data;

      // 🏁 CASE A: Conversation Concluded
      if (
        status === "submitted" ||
        nextQuestionToSpeak === "CONVERSATION_COMPLETE"
      ) {
        window.speechSynthesis.cancel();
        window.location.reload();
      }
      // 🔄 CASE B: Load next question turn cleanly
      else {
        setSubmission(updatedSubmission);
        setAudioBlob(null);
        setAudioUrl("");
        setRecordingDuration(0);

        setIsAiResponding(true);
        speakQuestionToStudent(nextQuestionToSpeak);
        setTimeout(() => setIsAiResponding(false), 4500);
      }
    } catch (err) {
      console.error("Failed to process turn transaction:", err);

      // 🟢 FIXED: Intercepts timeline parameters block anomalies and routes strings onto dashboard box panel layers
      const errorMsg =
        err.response?.data?.message ||
        "Error submitting turn. Please check connection routes.";
      setSubmitError(errorMsg);
    } finally {
      setIsFinishing(false);
    }
  };

  const formatClock = (s) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-sm font-medium text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Initializing Gemini conversational voice room layers...</span>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 min-h-screen flex flex-col justify-center items-center">
        <div className="text-red-500 text-3xl">⚠️</div>
        <h3 className="text-lg font-bold text-slate-800">
          Voice Room Initialization Failure
        </h3>
        <p className="text-sm text-slate-500 bg-red-50 border border-red-100 p-3 rounded">
          {error}
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded hover:bg-slate-700"
        >
          Return to Safety
        </button>
      </div>
    );
  }

  const isSubmitted = submission.status === "submitted";
  const classTitle =
    submission.classId?.name ||
    submission.assignmentId?.classId?.name ||
    "Academic Classroom Channel";
  const targetQuestion =
    submission.assignedQuestions?.[0] ||
    submission.assignmentId?.questionPool?.[0] ||
    "Tell me about yourself.";

  // 🟢 NEW: Server-Side Due Date Verification Gatekeeper Check
  const isOverdue =
    !isSubmitted &&
    submission.assignmentId?.dueDate &&
    new Date() > new Date(submission.assignmentId.dueDate);

  // 🛑 UX BLOCK: If overdue, bypass rendering audio setup, questions, or streaming hubs and show a locked notice panel card
  if (isOverdue) {
    return (
      <div className="w-full min-h-[calc(100vh-4.5rem)] flex items-center justify-center bg-slate-50/50 p-6 select-none">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 border border-amber-100 rounded-full flex items-center justify-center text-2xl mx-auto shadow-sm">
            ⏰
          </div>
          <div className="space-y-1.5 text-center">
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">
              Viva Room Locked
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              The evaluation due date has passed. Submissions are no longer
              accepted for this conversational viva workspace.
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
      {/* 👈 1. SIDEBAR METADATA BLOCK */}
      {!isSubmitted && (
        <div className="hidden md:flex w-full md:w-[340px] lg:w-[380px] bg-slate-50 border-r border-slate-200 p-6 shrink-0 flex-col justify-between">
          <div className="space-y-4">
            <button
              onClick={goBackToDashboard}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
            >
              <span>‹</span> Leave Stream Room
            </button>
            <div className="space-y-3 pt-1">
              <div className="w-12 h-12 rounded-lg bg-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-sm select-none">
                {classTitle.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
                  {classTitle}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  Audio Stream Processing Engine
                </p>
              </div>
            </div>

            {/* Real-time Tally Tracking Dashboard Indicator */}
            <div className="pt-2 space-y-1.5">
              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded text-[11px] font-bold block text-center uppercase tracking-wide">
                Interactive Voice Room
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 🖥️ 2. CONVERSATIONAL AUDIOSCAPE INTERFACE VIEWPORT AREA */}
      <div className="flex-1 p-4 sm:p-8 md:p-10 overflow-y-auto max-w-full flex flex-col justify-between">
        {/* Header Navigation */}
        <div className="w-full mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            {/* Mobile back button — always visible when submitted since sidebar is hidden then */}
            <button
              onClick={goBackToDashboard}
              className={`${!isSubmitted ? "md:hidden" : ""} text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 mb-1`}
            >
              ‹ Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              🎙️{" "}
              {submission.assignmentId?.title ||
                "Conversational Viva Voice Room"}
            </h1>
            {/* <p className="text-xs text-slate-400 font-medium tracking-wide font-mono">
              ACTIVE SUBMISSION ID TRACE: {id}
            </p> */}
          </div>
          <div className="shrink-0">
            {isSubmitted ? (
              <span className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold shadow-sm">
                Finalized & Locked
              </span>
            ) : isRoomActive ? (
              <span className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>{" "}
                SESSION ENGAGED
              </span>
            ) : (
              <span className="px-4 py-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-sm font-bold shadow-sm">
                Ready to Establish Connection
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Display Layout Arena */}
        <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-start my-auto">
          <div
            className={
              isSubmitted
                ? "lg:col-span-2 space-y-6"
                : "lg:col-span-3 space-y-6 max-w-4xl mx-auto w-full"
            }
          >
            {isSubmitted ? (
              /* 📜 POST-SUBMISSION STATUS DISPLAY */
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto shadow-sm">
                  ✓
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                  Conversational Assessment Completed
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Your live streaming voice script transaction token was safely
                  committed to the analytics evaluation core engine server
                  layer.
                </p>
                <button
                  onClick={goBackToDashboard}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition-all"
                >
                  Return to Classroom Desktop
                </button>
              </div>
            ) : (
              /* 🎙️ ACTIVE CONVERSATIONAL AUDIOSCAPE VIEW */
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8 text-center">
                {!isRoomActive ? (
                  /* Initial Entrance Prompt Wrapper */
                  <div className="py-8 space-y-5 max-w-md mx-auto">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 text-2xl rounded-full flex items-center justify-center mx-auto shadow-inner">
                      🤖
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-slate-800">
                        Enter Real-Time Multi-Modal Workspace
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        This session establishes a monitored conversational
                        voice bridge. The AI will prompt you with a question,
                        and you will manually record and upload each answer
                        turn. Clipboard and window visibility shifts are
                        strictly tracked.
                      </p>
                    </div>

                    {/* 🟢 NEW: Teacher's dos/don'ts — shown before the student starts the room */}
                    {submission.assignmentId?.instructions && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex items-start gap-3">
                        <span className="text-xl shrink-0 select-none">📋</span>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-amber-800">
                            Instructions from your instructor
                          </h4>
                          <p className="text-xs text-amber-700 whitespace-pre-wrap leading-relaxed">
                            {submission.assignmentId.instructions}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={enterRoom}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md tracking-wide"
                    >
                      ⚡ Establish Voice Connection
                    </button>
                  </div>
                ) : (
                  /* Manual Recording Turn-Based Hub Console layout */
                  <div className="space-y-8 animate-fadeIn">
                    {/* Active Prompt Container Box */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-2xl mx-auto text-left space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2. py-0.5 rounded border border-indigo-100">
                        Active Discussion Target Prompt
                      </span>
                      <p className="text-base font-bold text-slate-800 leading-snug">
                        {submission?.conversationHistory?.length > 0
                          ? submission.conversationHistory[
                              submission.conversationHistory.length - 1
                            ].text
                          : targetQuestion}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto pt-2">
                      {/* AI Avatar block */}
                      <div
                        className={`p-6 border rounded-2xl transition-all flex flex-col items-center justify-center space-y-4 ${isAiResponding ? "bg-indigo-50/70 border-indigo-200 shadow-sm ring-4 ring-indigo-50" : "bg-slate-50/50 border-slate-100"}`}
                      >
                        <div
                          className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-transform duration-300 ${isAiResponding ? "scale-110 bg-indigo-600 shadow-md text-white animate-pulse" : "bg-slate-200 text-slate-400"}`}
                        >
                          🤖
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">
                            AI Evaluator
                          </h4>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-500 mt-1 h-4">
                            {isAiResponding
                              ? "Speaking prompt..."
                              : "Waiting for response..."}
                          </p>
                        </div>
                      </div>

                      {/* Student Speaker Avatar Block */}
                      <div
                        className={`p-6 border rounded-2xl transition-all flex flex-col items-center justify-center space-y-4 ${isUserSpeaking ? "bg-emerald-50/70 border-emerald-200 shadow-sm ring-4 ring-emerald-50" : "bg-slate-50/50 border-slate-100"}`}
                      >
                        <div
                          className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-200 ${isUserSpeaking ? "scale-115 bg-emerald-600 text-white shadow-lg" : "bg-slate-200 text-slate-400"}`}
                        >
                          👨‍🎓
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">
                            You (Active Speaker)
                          </h4>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600 mt-1 h-4">
                            {isRecording
                              ? `Recording (${formatClock(recordingDuration)})`
                              : audioUrl
                                ? "Answer saved"
                                : "Microphone idle"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Playback Preview Drawer Element */}
                    {audioUrl && !isRecording && (
                      <div className="max-w-md mx-auto bg-slate-50 p-4 border rounded-xl space-y-1.5 text-left">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                          Review Recorded Answer Segment:
                        </span>
                        <audio
                          src={audioUrl}
                          controls
                          className="w-full h-10"
                        />
                      </div>
                    )}

                    {/* 🟢 NEW: Integrated Canvas Server-Side Timeline Rejection Message Box */}
                    {submitError && (
                      <div className="w-full max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-left">
                        <span className="text-xl shrink-0 select-none">⚠️</span>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-red-800">
                            Turn Rejection Trace
                          </h4>
                          <p className="text-xs text-red-600 font-medium leading-relaxed">
                            {submitError}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Control Actions Tray */}
                    <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl mx-auto">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        {!isRecording ? (
                          <button
                            onClick={startRecordingAnswer}
                            disabled={isAiResponding || isFinishing}
                            className="w-full sm:w-auto px-5 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                          >
                            <span className="w-2.5 h-2.5 bg-white rounded-full"></span>{" "}
                            {audioUrl
                              ? "Re-Record Response"
                              : "🎙️ Start Recording"}
                          </button>
                        ) : (
                          <button
                            onClick={stopRecordingAnswer}
                            className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 animate-pulse"
                          >
                            <span className="w-2.5 h-2.5 bg-white rounded-sm"></span>{" "}
                            🛑 Stop & Save Answer
                          </button>
                        )}
                      </div>

                      <button
                        onClick={handleTurnSubmission}
                        disabled={
                          isFinishing ||
                          isRecording ||
                          !audioBlob ||
                          isAiResponding
                        }
                        className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all select-none"
                      >
                        {isFinishing
                          ? "Saving turn..."
                          : submission?.status === "ongoing"
                            ? "Submit Answer & Next Question ⏩"
                            : "Submit Answer & Lock Session 🚀"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar Lane: AI Performance Feedback */}
          {isSubmitted && (
            <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-4 animate-fadeIn">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider">
                Evaluation Metrics
              </h3>

              {submission.assignmentId?.isResultPublished !== false ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Final Awarded Viva Score
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
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 text-left">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm shrink-0 select-none">
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

              <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-6 shadow-md space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm tracking-wide">
                  <span>🤖</span>{" "}
                  <span>LANG-AI INTERACTIVE CONVERSATION METRICS</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-medium whitespace-pre-wrap bg-slate-950/40 p-4 rounded-lg border border-slate-800/60 max-h-[320px] overflow-y-auto w-full">
                  {submission.aiEvaluation?.feedback ||
                    "AI conversation diagnostics logs are compiling for this dialogue track."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VivaWorkspace;
