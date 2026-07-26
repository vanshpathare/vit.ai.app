import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Auth from "./pages/Auth";
import { getInitials } from "./utils/getInitials";

// 🚀 IMPORT THE SEPARATED PAGE LAYOUTS
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";

// 🟢 STUDENT WORKSPACE COMPONENTS
import StudentClassView from "./pages/student/StudentClassView"; // 🟢 NEW: dedicated route for a classroom's assignment feed
import TextWorkspace from "./pages/student/TextWorkspace";
import VivaWorkspace from "./pages/student/VivaWorkspace";

// 🟢 TEACHER WORKSPACE COMPONENTS
import ClassDetail from "./pages/teacher/ClassDetail";
import SubmissionTracker from "./pages/teacher/SubmissionTracker";

// 🟢 NEW: Shared account page
import Account from "./pages/Account";

function Header({ userName, userRole, onLogout }) {
  const navigate = useNavigate();

  return (
    <nav className="h-12 bg-indigo-700 text-white flex items-center justify-between px-6 shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <span className="font-bold tracking-wide text-sm sm:text-base">
          LANG-AI PORTAL
        </span>
        <div className="h-4 w-px bg-indigo-500/50 hidden sm:block"></div>
        <span className="text-xs sm:text-sm text-indigo-100 hidden sm:block bg-indigo-800/60 px-2 py-0.5 rounded capitalize">
          {userRole} Workstation
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {/* 🟢 NEW: Clicking the initials avatar opens the account details page */}
          <button
            onClick={() => navigate("/account")}
            title="Account details"
            className="w-7 h-7 rounded-full bg-indigo-900 text-xs font-semibold flex items-center justify-center border border-indigo-400 uppercase hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer"
          >
            {getInitials(userName)}
          </button>
          <span className="text-sm font-medium hidden sm:inline">
            {userName}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-semibold text-indigo-200 hover:text-white bg-indigo-800 hover:bg-indigo-600 px-2.5 py-1 rounded transition-colors"
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-sm text-slate-500">
        Verifying security terminal connection...
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased flex flex-col">
      <Header userName={user.name} userRole={user.role} onLogout={logout} />

      <main className="flex-1 w-full">
        <Routes>
          {/* Base Dashboard routing conditional on role */}
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

          {/* 🟢 NEW: Student classroom assignment feed (was previously in-memory state) */}
          <Route
            path="/student/class/:classId"
            element={<StudentClassView />}
          />

          {/* Student Dedicated Test Workspace Screens */}
          <Route
            path="/student/text-workspace/:id"
            element={<TextWorkspace />}
          />
          <Route
            path="/student/viva-workspace/:id"
            element={<VivaWorkspace />}
          />

          {/* Teacher Classroom & Grading Screens */}
          <Route path="/teacher/class/:classId" element={<ClassDetail />} />
          <Route
            path="/teacher/assignment/:assignmentId"
            element={<SubmissionTracker />}
          />

          {/* 🟢 NEW: Shared account details page */}
          <Route path="/account" element={<Account />} />

          {/* Catch-all fallback redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App; 
