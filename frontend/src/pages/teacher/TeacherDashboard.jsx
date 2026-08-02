import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getMyClassroomsAPI, createClassroomAPI } from "../../services/api";
import { SUBJECT_ICONS, getSubjectIcon } from "../../utils/subjectIcons";

function TeacherDashboard() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  const [selectedSubjectIcon, setSelectedSubjectIcon] = useState(
    SUBJECT_ICONS[0].key,
  );
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

  const filteredClasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [classes, searchQuery]);

  const openCreateModal = () => {
    setNewClassName("");
    setNewClassDescription("");
    setSelectedSubjectIcon(SUBJECT_ICONS[0].key);
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
        subjectIcon: selectedSubjectIcon,
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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Hero illustration banner — desktop/laptop only */}
      <div className="hidden md:block relative rounded-2xl overflow-hidden shadow-sm border border-orange-100">
        <img
          src="/images/dashboard-hero.png"
          alt=""
          className="w-full h-40 lg:h-48 object-cover"
        />
      </div>

      {/* Search bar — mobile + desktop */}
      <div className="max-w-2xl mx-auto w-full">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your classrooms..."
            className="w-full h-12 pl-11 pr-4 text-sm bg-white border border-orange-100 rounded-full shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
          All Teams
        </h2>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-xs sm:text-sm font-bold rounded-full transition-all shadow-sm shrink-0"
        >
          + New Classroom
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
              {searchQuery
                ? "No classrooms match your search"
                : "No classrooms yet"}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery
                ? "Try a different search term."
                : "Create your first classroom to get a join code you can share with students."}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs sm:text-sm font-semibold rounded-full hover:shadow-md transition-all"
            >
              Create a Classroom
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 w-full grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
          {filteredClasses.map((item) => {
            const subject = getSubjectIcon(item.subjectIcon);
            return (
              <div
                key={item._id}
                onClick={() => navigate(`/teacher/class/${item._id}`)}
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
                    {item.studentsEnrolled?.length || 0} student
                    {item.studentsEnrolled?.length === 1 ? "" : "s"} enrolled
                  </p>
                </div>

                <div className="px-4 py-1 bg-orange-50/60 border-t border-orange-100 flex items-center justify-between text-slate-500 text-xs">
                  <span className="font-medium text-sm">Join code</span>
                  <span className="font-mono font-bold tracking-wider text-orange-600 bg-white px-2 text-lg py-0.5 rounded-full border border-orange-100">
                    {item.classCode}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Classroom Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={closeCreateModal}
          ></div>
          <div className="bg-white border border-orange-100 w-full max-w-md md:max-w-xl lg:max-w-2xl rounded-2xl shadow-2xl relative z-10 p-5 space-y-4 text-left max-h-[90vh] overflow-y-auto">
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
                <div className="font-mono text-2xl font-black tracking-[0.3em] text-orange-600 bg-orange-50 py-3 rounded-xl border border-orange-100">
                  {createdCode}
                </div>
                <button
                  onClick={closeCreateModal}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
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
                    className="w-full h-9 px-3 text-sm bg-orange-50/40 border border-orange-100 rounded-lg focus:bg-white focus:border-orange-400 focus:outline-none"
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
                    className="w-full px-3 py-2 text-sm bg-orange-50/40 border border-orange-100 rounded-lg focus:bg-white focus:border-orange-400 focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                    Subject Image
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {SUBJECT_ICONS.map((subject) => (
                      <button
                        key={subject.key}
                        type="button"
                        disabled={isCreating}
                        onClick={() => setSelectedSubjectIcon(subject.key)}
                        title={subject.label}
                        className={`relative h-14 rounded-lg bg-gradient-to-br ${subject.gradient} overflow-hidden border-2 transition-all ${
                          selectedSubjectIcon === subject.key
                            ? "border-orange-600 ring-2 ring-orange-200 scale-105"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={subject.image}
                          alt={subject.label}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {getSubjectIcon(selectedSubjectIcon).label}
                  </p>
                </div>

                <div className="flex justify-end items-center gap-2 pt-2 border-t border-orange-100">
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={closeCreateModal}
                    className="h-8 px-3 text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newClassName.trim()}
                    className="h-8 px-4 text-xs font-semibold bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 disabled:opacity-50 text-white rounded-lg shadow-sm"
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
