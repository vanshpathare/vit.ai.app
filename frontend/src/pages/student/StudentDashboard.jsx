//StudentDashboard.jsx

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getStudentDashboardAPI, joinClassroomAPI } from "../../services/api";
import { getSubjectIcon } from "../../utils/subjectIcons";

function StudentDashboard() {
  const navigate = useNavigate();

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [inputJoinCode, setInputJoinCode] = useState("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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

  // 🟢 NEW: Client-side search filter, mirrors TeacherDashboard
  const filteredClasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [classes, searchQuery]);

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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* 🟢 NEW: Hero illustration banner — desktop/laptop only, same image as teacher side */}
      <div className="hidden md:block relative rounded-2xl overflow-hidden shadow-sm border border-orange-100">
        <img
          src="/images/dashboard-hero.png"
          alt=""
          className="w-full h-40 lg:h-48 object-cover"
        />
      </div>

      {/* 🟢 NEW: Search bar — visible on mobile and desktop */}
      <div className="max-w-2xl mx-auto w-full">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your teams and courses..."
            className="w-full h-12 pl-11 pr-4 text-sm bg-white border border-orange-100 rounded-full shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
          All Teams
        </h2>
        <button
          onClick={openJoinModal}
          className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-xs sm:text-sm font-bold rounded-full transition-all shadow-sm flex items-center gap-1.5 shrink-0"
        >
          + Join a team
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading your classrooms...</span>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="bg-white border border-orange-100 rounded-2xl p-12 text-center max-w-3xl mx-auto my-8 space-y-6 shadow-sm">
          <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-2xl">
            🏫
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {searchQuery ? "No teams match your search" : "No teams found"}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery
                ? "Try a different search term."
                : "Enter a classroom code provided by your faculty advisor to sync your workstation."}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={openJoinModal}
              className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs sm:text-sm font-semibold rounded-full hover:shadow-md transition-all"
            >
              Enter Join Code
            </button>
          )}
        </div>
      ) : (
        // 🔧 Grid + card markup mirrors TeacherDashboard.jsx exactly (same minmax(380px,1fr)
        // breakpoint, same responsive title scale text-sm→lg:text-2xl) so cards look
        // identical between roles.
        <div className="grid gap-4 sm:gap-5 w-full grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
          {filteredClasses.map((item) => {
            // 🔧 Same card style as TeacherDashboard — reads the classroom's chosen
            // subjectIcon (set by the teacher when they created it) rather than
            // offering a picker, since students don't create classrooms.
            const subject = getSubjectIcon(item.subjectIcon);
            return (
              <div
                key={item._id}
                onClick={() => handleEnterClassroom(item)}
                className="bg-white border border-orange-100 rounded-2xl hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden group cursor-pointer"
              >
                {/* Gradient subject banner */}
                <div
                  className={`relative h-24 sm:h-28 bg-gradient-to-br ${subject.gradient} overflow-hidden`}
                >
                  <img
                    src={subject.image}
                    alt={subject.label}
                    className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute top-2.5 left-2.5 w-9 h-9 rounded-lg bg-white/90 backdrop-blur-sm text-slate-800 font-extrabold text-sm flex items-center justify-center shadow-sm">
                    {(item.name || "CR").substring(0, 2).toUpperCase()}
                  </div>
                </div>

                <div className="p-4 flex-1 space-y-1">
                  <h4 className="text-sm sm:text-base md:text-lg lg:text-2xl font-bold text-slate-900 leading-snug line-clamp-2 break-words group-hover:text-orange-600 transition-colors">
                    {item.name}
                  </h4>
                  <p className="text-xs md:text-lg text-slate-400 font-medium truncate">
                    Prof: {item.teacherId?.name || "Faculty Coordinator"}
                  </p>
                </div>

                <div className="px-4 py-2.5 bg-orange-50/60 border-t border-orange-100 flex items-center gap-5 text-slate-500 text-xs md:text-sm">
                  <span>📋 Tasks</span>
                  <span>🎒 Grades</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Join Classroom Modal ─── */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={closeJoinModal}
          ></div>
          <div className="bg-white border border-orange-100 w-full max-w-sm md:max-w-lg lg:max-w-lg rounded-2xl shadow-2xl relative z-10 p-5 space-y-4 text-left">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-50 rounded-lg text-orange-600 font-bold text-base flex items-center justify-center border border-orange-100 select-none">
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
                className="w-full h-10 px-3 text-sm bg-orange-50/40 border border-orange-100 rounded-lg focus:bg-white focus:border-orange-400 focus:outline-none"
              />
              <div className="flex justify-end items-center gap-2 pt-2 border-t border-orange-100">
                <button
                  type="button"
                  disabled={isSubmittingCode}
                  onClick={closeJoinModal}
                  className="h-8 px-3 text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCode || inputJoinCode.trim().length < 6}
                  className="h-8 px-4 text-xs font-semibold bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white rounded-lg shadow-sm"
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
