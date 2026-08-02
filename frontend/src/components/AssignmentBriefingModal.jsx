import React from "react";

export default function AssignmentBriefingModal({
  assignment,
  onClose,
  onConfirmStart,
  isInitializing,
}) {
  if (!assignment) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full text-white backdrop-blur-md">
              {assignment.modality || "Text-Only"}
            </span>
            <button
              onClick={onClose}
              disabled={isInitializing}
              className="text-white/80 hover:text-white font-bold text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold mt-2 leading-tight">
            {assignment.title}
          </h3>
          <p className="text-xs text-orange-100 mt-1 font-medium">
            Read all guidelines carefully before starting your attempt.
          </p>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 bg-orange-50/60 border border-orange-100 rounded-xl p-3 text-center">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-700">
                Total Marks
              </p>
              <p className="text-base font-extrabold text-orange-600">
                {assignment.totalMarks} Marks
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-700">
                Questions
              </p>
              <p className="text-base font-extrabold text-slate-800">
                {assignment.questionsPerStudent || 1} Question(s)
              </p>
            </div>
          </div>

          {/* Teacher's Instructions */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wider">
              📋 Instructions from Professor
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed min-h-[60px] whitespace-pre-wrap">
              {assignment.instructions &&
              assignment.instructions.trim() !== "" ? (
                assignment.instructions
              ) : (
                <span className="text-slate-400 italic">
                  Make sure to read each question carefully and follow standard
                  classroom submission ethics.
                </span>
              )}
            </div>
          </div>

          {/* ⚠️ Strict Warning Note */}
          <div className="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl space-y-1">
            <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>⚠️</span> Important Notice
            </p>
            <p className="text-[11px] text-amber-800 leading-normal">
              Once you start the assignment,{" "}
              <strong>do not leave or close in between</strong>. Switching tabs
              or exiting will be considered as a copy case.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isInitializing}
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirmStart(assignment._id)}
            disabled={isInitializing}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            {isInitializing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Launching Workspace...</span>
              </>
            ) : (
              <>
                <span>I Agree, Start Assessment</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
