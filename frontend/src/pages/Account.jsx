import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getInitials } from "../utils/getInitials";

function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          <span className="inline-block mt-2 text-[11px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full capitalize">
            {user?.role || "member"} account
          </span>
        </div>

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
