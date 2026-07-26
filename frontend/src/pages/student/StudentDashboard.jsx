//StudentDashboard.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getStudentDashboardAPI, joinClassroomAPI } from "../../services/api";

function StudentDashboard() {
  const navigate = useNavigate();

  // 2️⃣ Interactive Modal Controls
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [inputJoinCode, setInputJoinCode] = useState("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  // 3️⃣ Core Data Store
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🔄 FETCH ALL USER CLASSES
  const fetchStudentClassrooms = async () => {
    try {
      setIsLoading(true);
      const response = await getStudentDashboardAPI();
      if (Array.isArray(response.data)) {
        setClasses(response.data);
      } else if (response.data && Array.isArray(response.data.classes)) {
        setClasses(response.data.classes);
      }
    } catch (err) {
      console.error("Failed to gather student classroom roster:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentClassrooms();
  }, []);

  const openJoinModal = () => {
    setModalError("");
    setModalSuccess("");
    setIsJoinModalOpen(true);
    setInputJoinCode("");
  };

  const closeJoinModal = () => {
    if (!isSubmittingCode) {
      setModalError("");
      setModalSuccess("");
      setIsJoinModalOpen(false);
    }
  };

  // 🚪 ENTER CLASSROOM — 🟢 now a real route so the browser back button and the
  // workspace's "leave" buttons can return here directly instead of relying on
  // in-memory component state that resets on every navigation.
  const handleEnterClassroom = (classroomObj) => {
    navigate(`/student/class/${classroomObj._id}`);
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!inputJoinCode || inputJoinCode.trim().length < 6) {
      setModalError("Please enter a valid 6-character classroom token.");
      return;
    }
    setIsSubmittingCode(true);
    setModalError("");

    try {
      const response = await joinClassroomAPI(inputJoinCode.trim());
      setModalSuccess(
        `Successfully registered! Added to: ${response.data.classroomName}`,
      );
      await fetchStudentClassrooms();
      setTimeout(() => {
        setIsJoinModalOpen(false);
        setInputJoinCode("");
        setModalSuccess("");
      }, 1500);
    } catch (err) {
      setModalError(
        err.response?.data?.message ||
          "Classroom token sync connection anomaly occurred.",
      );
    } finally {
      setIsSubmittingCode(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h2 className="text-base font-bold text-slate-800">All Teams</h2>
        <button
          onClick={openJoinModal}
          className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded transition-colors flex items-center gap-2 shadow-sm bg-white"
        >
          👥 Join team with code
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading your classrooms...</span>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center max-w-3xl my-8 space-y-6 shadow-sm border-t-4 border-t-indigo-600">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-2xl">
            🏫
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No teams found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Enter a classroom code provided by your faculty advisor to sync
              your workstation.
            </p>
          </div>
          <button
            onClick={openJoinModal}
            className="px-5 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded hover:bg-indigo-700"
          >
            Enter Join Code
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 w-full grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(410px,1fr))]">
          {classes.map((item) => (
            <div
              key={item._id}
              onClick={() => handleEnterClassroom(item)}
              className="bg-white border border-slate-200 rounded-lg hover:shadow-lg hover:border-slate-300 transition-all duration-200 flex flex-col justify-between w-full min-h-[115px] sm:min-h-[145px] group relative cursor-pointer"
            >
              <div className="p-4 flex items-start gap-4 flex-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg shrink-0 bg-indigo-600 text-white font-bold text-base flex items-center justify-center select-none shadow-sm group-hover:scale-105 transition-transform">
                  {(item.name || "CR").substring(0, 2).toUpperCase()}
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2 break-words group-hover:text-indigo-600 pr-3">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium truncate">
                    Prof: {item.teacherId?.name || "Faculty Coordinator"}
                  </p>
                </div>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 rounded-b-lg flex items-center gap-5 text-slate-400 text-sm">
                <span>📋 Tasks</span>
                <span>🎒 Grades</span>
              </div>
            </div>
          ))}
        </div>
      )} 

      {/* ─── 🎭 JOIN CLASSROOM MODAL ─── */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={closeJoinModal}
          ></div>
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-2xl relative z-10 p-5 space-y-4 text-left">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded text-slate-700 font-bold text-base flex items-center justify-center border border-slate-200 select-none">
                  #
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                    Join a team with a code
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Enter code sent by your faculty
                  </p>
                </div>
              </div>
              <button
                disabled={isSubmittingCode}
                onClick={closeJoinModal}
                className="text-slate-400 hover:text-slate-600 font-semibold text-sm focus:outline-none"
              >
                ✕
              </button>
            </div>
            {modalError && (
              <div className="p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded">
                ⚠️ {modalError}
              </div>
            )}
            {modalSuccess && (
              <div className="p-2 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-semibold rounded">
                ✅ {modalSuccess}
              </div>
            )}
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <input
                type="text"
                required
                disabled={isSubmittingCode}
                value={inputJoinCode}
                onChange={(e) => setInputJoinCode(e.target.value)}
                placeholder="Enter join code..."
                maxLength={10}
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
              <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingCode}
                  onClick={closeJoinModal}
                  className="h-8 px-3 text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCode || inputJoinCode.trim().length < 6}
                  className="h-8 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm"
                >
                  Add team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;
