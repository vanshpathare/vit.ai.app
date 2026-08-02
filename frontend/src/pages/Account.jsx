import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getInitials } from "../utils/getInitials";
import { updateRollNumberAPI } from "../services/api";

function Account() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

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
    /* 🟢 Increased max-width and vertical padding on tablet/desktop */
    <div className="w-full max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-16 lg:py-20">
      <button
        onClick={() => navigate(-1)}
        className="text-xs md:text-sm font-bold text-slate-500 hover:text-orange-600 flex items-center gap-1.5 mb-6 md:mb-8 transition-colors"
      >
        <span className="text-sm md:text-base">‹</span> Back
      </button>

      {/* 🟢 Increased vertical height & spacing using md:p-14, lg:p-16, md:space-y-8 */}
      <div className="bg-white border border-orange-100 rounded-2xl shadow-sm p-6 sm:p-10 md:p-14 lg:p-16 text-center space-y-6 md:space-y-8">
        {/* 🟢 Scaled avatar circle: 20x20 on mobile -> 28x28 on tablet -> 32x32 on laptop */}
        <div className="w-20 h-20 md:w-28 md:h-28 lg:w-32 lg:h-32 mx-auto rounded-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-extrabold text-2xl md:text-4xl lg:text-5xl flex items-center justify-center shadow-md uppercase select-none">
          {getInitials(user?.name)}
        </div>

        {/* 🟢 Scaled typography hierarchy */}
        <div className="space-y-2 md:space-y-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            {user?.name || "Unnamed User"}
          </h2>
          <p className="text-sm md:text-base lg:text-lg text-slate-400 font-medium break-all">
            {user?.email || "No email on file"}
          </p>

          {isStudent && user?.rollNumber && (
            <p className="text-sm md:text-base lg:text-lg text-slate-600 font-mono font-bold pt-1">
              Roll No: {user.rollNumber}
            </p>
          )}

          <div className="pt-2">
            <span className="inline-block text-[11px] md:text-xs lg:text-sm font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100 capitalize">
              {user?.role || "member"} account
            </span>
          </div>
        </div>

        {needsRollNumber && (
          <div className="border-t border-orange-100 pt-6 md:pt-8 text-left space-y-4 max-w-xl mx-auto">
            <div className="p-3.5 md:p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-xs md:text-sm font-medium rounded-lg leading-relaxed">
              ⚠️ Your account doesn't have a roll number on file yet. Add it
              below — your teacher needs this to sort and export grades
              correctly.
            </div>
            {saveError && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs md:text-sm font-semibold rounded-lg">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs md:text-sm font-semibold rounded-lg">
                ✅ {saveSuccess}
              </div>
            )}
            <form onSubmit={handleSaveRollNumber} className="flex gap-3">
              <input
                type="text"
                value={rollNumberInput}
                onChange={(e) => setRollNumberInput(e.target.value)}
                placeholder="e.g. 24102B0011"
                disabled={isSaving}
                className="flex-1 h-11 md:h-12 px-4 text-sm md:text-base font-mono uppercase bg-orange-50/40 border border-orange-100 rounded-xl focus:bg-white focus:border-orange-400 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 h-11 md:h-12 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 disabled:opacity-50 text-white text-xs md:text-sm font-bold rounded-xl shadow-sm whitespace-nowrap transition-all"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        )}

        {/* 🟢 Taller Sign Out button section */}
        <div className="border-t border-orange-100 pt-6 md:pt-8 max-w-xl mx-auto">
          <button
            onClick={logout}
            className="w-full py-3.5 md:py-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm md:text-base lg:text-lg rounded-xl md:rounded-2xl transition-colors border border-red-100"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Account;
