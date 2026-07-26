import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyClassroomsAPI, createClassroomAPI } from "../../services/api";

function TeacherDashboard() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  const fetchClassrooms = async () => {
    try {
      setIsLoading(true);
      const response = await getMyClassroomsAPI();
      if (Array.isArray(response.data)) setClasses(response.data);
    } catch (err) {
      console.error("Failed to load teacher classrooms:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const openCreateModal = () => {
    setNewClassName("");
    setNewClassDescription("");
    setCreateError("");
    setCreatedCode("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (!isCreating) setIsCreateModalOpen(false);
  };

  const handleCreateClassroom = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      setCreateError("Please give your classroom a name.");
      return;
    }
    setIsCreating(true);
    setCreateError("");
    try {
      const response = await createClassroomAPI({
        name: newClassName.trim(),
        description: newClassDescription.trim(),
      });
      setCreatedCode(response.data.classroom.classCode);
      await fetchClassrooms();
    } catch (err) {
      setCreateError(
        err.response?.data?.message || "Could not create classroom.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            Your Classrooms
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Manage rosters, assignments, and grading in one place.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-lg transition-colors shadow-sm shrink-0"
        >
          + New Classroom
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading your classrooms...</span>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center max-w-3xl mx-auto my-8 space-y-6 shadow-sm border-t-4 border-t-indigo-600">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-2xl">
            🏫
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              No classrooms yet
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Create your first classroom to get a join code you can share with
              students.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-5 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded hover:bg-indigo-700"
          >
            Create a Classroom
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 w-full grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
          {classes.map((item) => (
            <div
              key={item._id}
              onClick={() => navigate(`/teacher/class/${item._id}`)}
              className="bg-white border border-slate-200 rounded-lg hover:shadow-lg hover:border-slate-300 transition-all duration-200 flex flex-col justify-between w-full min-h-[125px] group relative cursor-pointer"
            >
              <div className="p-4 flex items-start gap-4 flex-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg shrink-0 bg-indigo-600 text-white font-bold text-base flex items-center justify-center select-none shadow-sm group-hover:scale-105 transition-transform">
                  {(item.name || "CR").substring(0, 2).toUpperCase()}
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2 break-words group-hover:text-indigo-600">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium truncate">
                    {item.studentsEnrolled?.length || 0} student
                    {item.studentsEnrolled?.length === 1 ? "" : "s"} enrolled
                  </p>
                </div>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 rounded-b-lg flex items-center justify-between text-slate-500 text-xs">
                <span className="font-medium">Join code</span>
                <span className="font-mono font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {item.classCode}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create Classroom Modal ─── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={closeCreateModal}
          ></div>
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-2xl relative z-10 p-5 space-y-4 text-left">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Create a classroom
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  You'll get a code to share with students
                </p>
              </div>
              <button
                disabled={isCreating}
                onClick={closeCreateModal}
                className="text-slate-400 hover:text-slate-600 font-semibold text-sm"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded">
                ⚠️ {createError}
              </div>
            )}

            {createdCode ? (
              <div className="space-y-4 text-center py-2">
                <div className="text-3xl">🎉</div>
                <p className="text-sm text-slate-600 font-medium">
                  Classroom created! Share this code with your students:
                </p>
                <div className="font-mono text-2xl font-black tracking-[0.3em] text-indigo-600 bg-indigo-50 py-3 rounded-lg border border-indigo-100">
                  {createdCode}
                </div>
                <button
                  onClick={closeCreateModal}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateClassroom} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Classroom Name
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isCreating}
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. Data Structures - Sem 4"
                    className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    disabled={isCreating}
                    value={newClassDescription}
                    onChange={(e) => setNewClassDescription(e.target.value)}
                    placeholder="What is this classroom about?"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-600 focus:outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={closeCreateModal}
                    className="h-8 px-3 text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newClassName.trim()}
                    className="h-8 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded shadow-sm"
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
