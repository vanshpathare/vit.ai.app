import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getInitials } from "../utils/getInitials";
import { updateRollNumberAPI } from "../services/api"; // 🟢 NEW

function Account() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  // 🟢 NEW: Local state for the "add your roll number" migration form, shown only
  // when a student account doesn't have one yet.
  const [rollNumberInput, setRollNumberInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const isStudent = user?.role === "student";
  const needsRollNumber = isStudent && !user?.rollNumber;

  const handleSaveRollNumber = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess("");

    if (!rollNumberInput.trim()) {
      setSaveError("Please enter your roll number.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await updateRollNumberAPI(rollNumberInput.trim());
      updateUser({ rollNumber: response.data.user.rollNumber });
      setSaveSuccess("Roll number saved!");
      setRollNumberInput("");
    } catch (err) {
      setSaveError(
        err.response?.data?.message || "Could not save roll number.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-14">
      <button
        onClick={() => navigate(-1)}
        className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 mb-6"
      >
        <span>‹</span> Back
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 sm:p-10 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center shadow-md uppercase select-none">
          {getInitials(user?.name)}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {user?.name || "Unnamed User"}
          </h2>
          <p className="text-sm text-slate-400 font-medium break-all">
            {user?.email || "No email on file"}
          </p>

          {/* 🟢 NEW: Roll number display, students only */}
          {isStudent && user?.rollNumber && (
            <p className="text-sm text-slate-600 font-mono font-bold">
              Roll No: {user.rollNumber}
            </p>
          )}

          <span className="inline-block mt-2 text-[11px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full capitalize">
            {user?.role || "member"} account
          </span>
        </div>

        {/* 🟢 NEW: Self-service roll number form — only shown for students who
            registered before this field existed and don't have one yet. */}
        {needsRollNumber && (
          <div className="border-t border-slate-100 pt-6 text-left space-y-3">
            <div className="p-3 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-xs font-medium rounded leading-relaxed">
              ⚠️ Your account doesn't have a roll number on file yet. Add it
              below — your teacher needs this to sort and export grades
              correctly.
            </div>
            {saveError && (
              <div className="p-2.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="p-2.5 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-semibold rounded">
                ✅ {saveSuccess}
              </div>
            )}
            <form onSubmit={handleSaveRollNumber} className="flex gap-2">
              <input
                type="text"
                value={rollNumberInput}
                onChange={(e) => setRollNumberInput(e.target.value)}
                placeholder="e.g. 24102B0011"
                disabled={isSaving}
                className="flex-1 h-10 px-3 text-sm font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm whitespace-nowrap"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        )}

        <div className="border-t border-slate-100 pt-6">
          <button
            onClick={logout}
            className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm rounded-xl transition-colors border border-red-100"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Account;
