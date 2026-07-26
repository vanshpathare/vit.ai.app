import React, { useState } from "react";
import {
  createAssignmentAPI,
  updateAssignmentAPI,
  generateQuestionsFromMaterialAPI,
} from "../../services/api";

// Converts a stored ISO date into the value shape <input type="datetime-local"> expects
const toDatetimeLocal = (dateValue) => {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

/**
 * Shared modal for both creating a brand new assignment and editing an existing one.
 * Pass `existingAssignment` to switch into edit mode (pre-fills every field and PUTs
 * instead of POSTs on save).
 */
function AssignmentEditorModal({
  classId,
  onClose,
  onSaved,
  existingAssignment,
}) {
  const isEditMode = Boolean(existingAssignment);

  const [title, setTitle] = useState(existingAssignment?.title || "");
  const [modality, setModality] = useState(
    existingAssignment?.modality || "Text-Only",
  );
  const [dueDate, setDueDate] = useState(
    toDatetimeLocal(existingAssignment?.dueDate),
  );
  const [totalMarks, setTotalMarks] = useState(
    existingAssignment?.totalMarks || 20,
  );
  const [aiNotes, setAiNotes] = useState(existingAssignment?.aiNotes || "");
  const [isResultPublished, setIsResultPublished] = useState(
    existingAssignment?.isResultPublished ?? false,
  );
  const [allowMultipleSubmissions, setAllowMultipleSubmissions] = useState(
    existingAssignment?.allowMultipleSubmissions ?? false,
  );
  const [distributionType, setDistributionType] = useState(
    existingAssignment?.distributionType || "same-for-all",
  );
  const [questionsPerStudent, setQuestionsPerStudent] = useState(
    existingAssignment?.questionsPerStudent || 1,
  );

  const [criteria, setCriteria] = useState(() => {
    const raw = existingAssignment?.evaluationCriteria;
    if (raw) {
      const entries =
        raw instanceof Map ? Array.from(raw.entries()) : Object.entries(raw);
      if (entries.length > 0) {
        return entries.map(([name, marks]) => ({ name, marks }));
      }
    }
    return [
      {
        name: "Overall Performance",
        marks: existingAssignment?.totalMarks || 20,
      },
    ];
  });

  const [questions, setQuestions] = useState(
    existingAssignment?.questionPool?.length
      ? [...existingAssignment.questionPool]
      : [""],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Material -> AI question generation panel state
  const [materialFile, setMaterialFile] = useState(null);
  const [genCount, setGenCount] = useState(5);
  const [genFocus, setGenFocus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const addQuestion = () => setQuestions((q) => [...q, ""]);
  const updateQuestion = (idx, val) =>
    setQuestions((q) => q.map((item, i) => (i === idx ? val : item)));
  const removeQuestion = (idx) =>
    setQuestions((q) => q.filter((_, i) => i !== idx));

  const addCriteria = () => setCriteria((c) => [...c, { name: "", marks: 0 }]);
  const updateCriteria = (idx, field, val) =>
    setCriteria((c) =>
      c.map((item, i) => (i === idx ? { ...item, [field]: val } : item)),
    );
  const removeCriteria = (idx) =>
    setCriteria((c) => c.filter((_, i) => i !== idx));

  const criteriaSum = criteria.reduce(
    (sum, c) => sum + (parseFloat(c.marks) || 0),
    0,
  );

  const handleGenerateFromMaterial = async () => {
    if (!materialFile) {
      setGenError("Please choose a reference document first.");
      return;
    }
    setIsGenerating(true);
    setGenError("");
    try {
      const formData = new FormData();
      formData.append("docFile", materialFile);
      formData.append("count", genCount);
      formData.append("dynamicFocus", genFocus);

      const response = await generateQuestionsFromMaterialAPI(formData);
      const generated = response.data.questionPool || [];

      setQuestions((prev) => {
        const cleanedPrev = prev.filter((q) => q.trim() !== "");
        return [...cleanedPrev, ...generated];
      });
      setMaterialFile(null);
    } catch (err) {
      setGenError(
        err.response?.data?.message ||
          "Could not generate questions from this file.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    setSaveError("");

    const cleanQuestions = questions.map((q) => q.trim()).filter(Boolean);
    if (cleanQuestions.length === 0) {
      setSaveError("Add at least one question to the pool.");
      return;
    }
    if (!title.trim()) {
      setSaveError("Please give this assignment a title.");
      return;
    }
    if (!dueDate) {
      setSaveError("Please set a due date.");
      return;
    }
    if (
      distributionType === "random" &&
      (!questionsPerStudent || questionsPerStudent > cleanQuestions.length)
    ) {
      setSaveError(
        "Questions per student must be between 1 and the total pool size.",
      );
      return;
    }

    const cleanCriteria = criteria.filter((c) => c.name.trim() !== "");
    const evaluationCriteria = Object.fromEntries(
      cleanCriteria.map((c) => [c.name.trim(), parseFloat(c.marks) || 0]),
    );

    const payload = {
      classId,
      title: title.trim(),
      questionPool: cleanQuestions,
      questionsPerStudent: parseInt(questionsPerStudent) || 1,
      modality,
      totalMarks: parseFloat(totalMarks) || 0,
      evaluationCriteria,
      aiNotes: aiNotes.trim(),
      dueDate: new Date(dueDate).toISOString(),
      distributionType,
      isResultPublished,
      allowMultipleSubmissions,
    };

    setIsSaving(true);
    try {
      if (isEditMode) {
        await updateAssignmentAPI(existingAssignment._id, payload);
      } else {
        await createAssignmentAPI(payload);
      }
      onSaved();
    } catch (err) {
      setSaveError(err.response?.data?.message || "Failed to save assignment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !isSaving && onClose()}
      ></div>
      <div className="bg-white border border-slate-200 w-full max-w-3xl max-h-[95vh] rounded-xl shadow-2xl relative z-10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {isEditMode ? "Edit Assignment" : "Create New Assignment"}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Configure questions, grading, and delivery rules
            </p>
          </div>
          <button
            disabled={isSaving}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-semibold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {saveError && (
            <div className="p-2.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded">
              ⚠️ {saveError}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Assignment Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Email Writing & Professional Communication"
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Modality
              </label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
              >
                <option value="Text-Only">Text-Only</option>
                <option value="Speech-Only">Speech-Only (Viva)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Due Date
              </label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Total Marks
              </label>
              <input
                type="number"
                min="1"
                required
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Attempt Policy
              </label>
              <select
                value={allowMultipleSubmissions ? "multiple" : "single"}
                onChange={(e) =>
                  setAllowMultipleSubmissions(e.target.value === "multiple")
                }
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
              >
                <option value="single">Single attempt only</option>
                <option value="multiple">Allow multiple attempts</option>
              </select>
            </div>
          </div>

          {/* Publish toggle */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-4 gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800">
                Publish results to students
              </p>
              <p className="text-[11px] text-slate-400">
                Students only see numeric marks when this is on — you can toggle
                it anytime from the assignment page.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isResultPublished}
              onClick={() => setIsResultPublished((p) => !p)}
              className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0.5 transition-colors duration-200 focus:outline-none ${
                isResultPublished ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  isResultPublished ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Question Distribution */}
          <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm font-bold text-slate-800">
              Question Distribution
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Distribution Type
                </label>
                <select
                  value={distributionType}
                  onChange={(e) => setDistributionType(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded focus:border-indigo-600 focus:outline-none"
                >
                  <option value="same-for-all">
                    Same questions for everyone
                  </option>
                  <option value="random">Randomize per student</option>
                </select>
              </div>
              {distributionType === "random" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Questions Per Student
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={questionsPerStudent}
                    onChange={(e) => setQuestionsPerStudent(e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* AI Question Generator */}
          <div className="space-y-3 bg-indigo-50/50 border border-indigo-100 rounded-lg p-4">
            <p className="text-sm font-bold text-slate-800">
              ✨ Generate Questions from Material
            </p>
            <p className="text-[11px] text-slate-500">
              Upload reference notes (.pdf, .docx, .txt, .md) and let the AI
              draft standalone exam questions you can edit below.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
                className="sm:col-span-3 text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
              <input
                type="number"
                min="1"
                max="30"
                value={genCount}
                onChange={(e) => setGenCount(e.target.value)}
                placeholder="Count"
                className="h-9 px-3 text-sm bg-white border border-slate-200 rounded focus:border-indigo-600 focus:outline-none"
              />
              <input
                type="text"
                value={genFocus}
                onChange={(e) => setGenFocus(e.target.value)}
                placeholder="Focus (optional)"
                className="sm:col-span-2 h-9 px-3 text-sm bg-white border border-slate-200 rounded focus:border-indigo-600 focus:outline-none"
              />
            </div>
            {genError && (
              <p className="text-xs text-red-600 font-semibold">{genError}</p>
            )}
            <button
              type="button"
              onClick={handleGenerateFromMaterial}
              disabled={isGenerating || !materialFile}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              {isGenerating ? "Generating..." : "Generate Questions"}
            </button>
          </div>

          {/* Question Pool */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">
                Question Pool ({questions.filter((q) => q.trim()).length})
              </p>
              <button
                type="button"
                onClick={addQuestion}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                + Add Question
              </button>
            </div>
            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-xs font-bold text-slate-400 mt-2.5 w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <textarea
                    rows={2}
                    value={q}
                    onChange={(e) => updateQuestion(idx, e.target.value)}
                    placeholder="Type a question..."
                    className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="text-slate-400 hover:text-red-600 font-bold text-sm mt-2 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Evaluation Criteria */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">
                Evaluation Criteria
              </p>
              <button
                type="button"
                onClick={addCriteria}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                + Add Criterion
              </button>
            </div>
            <div className="space-y-2">
              {criteria.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) =>
                      updateCriteria(idx, "name", e.target.value)
                    }
                    placeholder="e.g. Content, Grammar, Format"
                    className="flex-1 h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    value={c.marks}
                    onChange={(e) =>
                      updateCriteria(idx, "marks", e.target.value)
                    }
                    placeholder="Marks"
                    className="w-24 h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeCriteria(idx)}
                    className="text-slate-400 hover:text-red-600 font-bold text-sm shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p
              className={`text-[11px] font-bold ${
                criteriaSum === parseFloat(totalMarks)
                  ? "text-emerald-600"
                  : "text-amber-600"
              }`}
            >
              Criteria total: {criteriaSum} / {totalMarks} marks
              {criteriaSum !== parseFloat(totalMarks) &&
                " (should match total marks)"}
            </p>
          </div>

          {/* AI Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              AI Grading Notes (optional)
            </label>
            <textarea
              rows={3}
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              placeholder="e.g. Focus on clarity, keep scores generous between 15-20 range"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-2 px-5 sm:px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-9 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded shadow-sm"
          >
            {isSaving
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Create Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssignmentEditorModal;
