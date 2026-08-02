import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Auth from "./pages/Auth";
import { getInitials } from "./utils/getInitials";

import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";

import StudentClassView from "./pages/student/StudentClassView";
import TextWorkspace from "./pages/student/TextWorkspace";
import VivaWorkspace from "./pages/student/VivaWorkspace";

import ClassDetail from "./pages/teacher/ClassDetail";
import SubmissionTracker from "./pages/teacher/SubmissionTracker";

import Account from "./pages/Account";
import logoImg from "./assets/assignbuddy_logo_without_text.png";

// 🔧 RE-THEMED: indigo → warm orange/amber gradient, matching the reference design.
// This is the color system every other page should follow when you extend the
// re-theme further: primary accent = orange-600, gradient = orange-500→amber-500,
// warm page background = amber-50/orange-50, cards stay white for contrast.
function Header({ userName, userRole, onLogout }) {
  const navigate = useNavigate();

  return (
    <nav className="h-14 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white flex items-center justify-between px-4 sm:px-6 shadow-md shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          {/* White Circular Backdrop Wrapper */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-white rounded-xl flex items-center justify-center p-1 shadow-sm shrink-0">
            <img
              src={logoImg}
              alt="AssignBuddy Logo"
              className="w-full h-full object-contain "
            />
          </div>

          <span className="font-extrabold tracking-tight text-base sm:text-lg md:text-xl text-white">
            AssignBuddy
          </span>
        </div>
        <div className="h-4 w-px bg-white/25 hidden sm:block"></div>
        <span className="text-xs sm:text-sm text-orange-50 hidden sm:block bg-white/15 px-2.5 py-1 rounded-full capitalize font-medium">
          {userRole} Workstation
        </span>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/account")}
            title="Account details"
            className="w-8 h-8 rounded-full bg-white text-orange-600 text-xs font-extrabold flex items-center justify-center border-2 border-white/60 uppercase hover:scale-105 transition-transform shadow-sm cursor-pointer"
          >
            {getInitials(userName)}
          </button>
          <span className="text-sm font-semibold hidden sm:inline">
            {userName}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-bold text-orange-700 bg-white hover:bg-orange-50 px-3 py-1.5 rounded-full transition-colors shadow-sm"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}

function App() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center font-sans text-sm text-slate-500">
        Verifying security terminal connection...
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    // 🔧 RE-THEMED: warm gradient page background instead of flat slate-50
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/40 to-white font-sans text-slate-900 antialiased flex flex-col">
      <Header userName={user.name} userRole={user.role} onLogout={logout} />

      <main className="flex-1 w-full">
        <Routes>
          <Route
            path="/"
            element={
              user.role === "teacher" ? (
                <TeacherDashboard />
              ) : (
                <StudentDashboard />
              )
            }
          />

          <Route
            path="/student/class/:classId"
            element={<StudentClassView />}
          />
          <Route
            path="/student/text-workspace/:id"
            element={<TextWorkspace />}
          />
          <Route
            path="/student/viva-workspace/:id"
            element={<VivaWorkspace />}
          />

          <Route path="/teacher/class/:classId" element={<ClassDetail />} />
          <Route
            path="/teacher/assignment/:assignmentId"
            element={<SubmissionTracker />}
          />

          <Route path="/account" element={<Account />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
