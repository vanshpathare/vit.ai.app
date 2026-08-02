import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  getClassroomDetailsAPI,
  getClassAssignmentsAPI,
  getClassGradebookAPI,
  getClassroomResourcesAPI, // 🟢 NEW
  createClassroomResourceAPI, // 🟢 NEW
  deleteResourceAPI, // 🟢 NEW
} from "../../services/api";
import AssignmentEditorModal from "../../components/teacher/AssignmentEditorModal";
import { getInitials } from "../../utils/getInitials";
import { compareRollNumbers } from "../../utils/rollNumberSort";
import { Video, Folder, FileText } from "lucide-react";
import { getPreviewUrl } from "../../utils/getPreviewUrl";
import DocxViewerModal from "../../components/DocxViewerModal";

function ClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [resources, setResources] = useState([]); // 🟢 NEW: State for Files Tab
  const [activeTab, setActiveTab] = useState("assignments"); // 'assignments' | 'students' | 'files'
  const [isLoading, setIsLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false); // 🟢 NEW
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // 🟢 NEW: File Upload Modal State
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState("file"); // "file" | "link"
  const [fileTitle, setFileTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmittingResource, setIsSubmittingResource] = useState(false);

  const [previewDoc, setPreviewDoc] = useState(null);

  const fetchClassroom = async () => {
    try {
      setIsLoading(true);
      const response = await getClassroomDetailsAPI(classId);
      setClassroom(response.data);
    } catch (err) {
      console.error("Failed to load classroom:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      setIsAssignmentsLoading(true);
      const response = await getClassAssignmentsAPI(classId);
      if (Array.isArray(response.data)) setAssignments(response.data);
    } catch (err) {
      console.error("Failed to load assignments:", err);
    } finally {
      setIsAssignmentsLoading(false);
    }
  };

  // 🟢 NEW: Fetch Classroom Resources (Files / Links)
  const fetchResources = async () => {
    try {
      setIsResourcesLoading(true);
      const response = await getClassroomResourcesAPI(classId);

      // 🟢 UNWRAP Axios data cleanly: checks response.data.data first, then fallback to response.data
      const resourceList = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];

      setResources(resourceList);
    } catch (err) {
      console.error("Failed to load resources:", err);
    } finally {
      setIsResourcesLoading(false);
    }
  };

  useEffect(() => {
    fetchClassroom();
    fetchAssignments();
    fetchResources(); // 🟢 Load resources on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const handleAssignmentSaved = () => {
    setIsEditorOpen(false);
    fetchAssignments();
  };

  const sortedStudents = useMemo(() => {
    return [...(classroom?.studentsEnrolled || [])].sort((a, b) =>
      compareRollNumbers(a.rollNumber, b.rollNumber),
    );
  }, [classroom]);

  // 🟢 NEW: Handle Uploading Resource (Supabase File OR Drive/YouTube Link)
  const handleAddResourceSubmit = async (e) => {
    e.preventDefault();
    if (uploadType === "file" && !selectedFile) return;
    if (uploadType === "link" && !linkUrl.trim()) return;

    setIsSubmittingResource(true);
    try {
      const formData = new FormData();
      formData.append("resourceType", uploadType);
      formData.append(
        "title",
        fileTitle || selectedFile?.name || "Untitled Resource",
      );

      if (uploadType === "file") {
        formData.append("file", selectedFile);
        const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "file";
        formData.append("fileType", ext);
      } else {
        formData.append("url", linkUrl);
        let linkKind = "drive";
        if (linkUrl.includes("youtube.com") || linkUrl.includes("youtu.be")) {
          linkKind = "youtube";
        }
        formData.append("fileType", linkKind);
      }

      const response = await createClassroomResourceAPI(classId, formData);

      // 🟢 Extract newly created item from response.data.data
      const newResourceItem = response.data?.data || response.data;

      // Instantly append to state so UI re-renders without needing full refresh
      setResources((prev) => [newResourceItem, ...prev]);

      // Reset Modal
      setIsFileModalOpen(false);
      setFileTitle("");
      setLinkUrl("");
      setSelectedFile(null);
    } catch (err) {
      console.error("Failed to add resource:", err);
      alert(
        err.response?.data?.message || "Failed to upload file or save link.",
      );
    } finally {
      setIsSubmittingResource(false);
    }
  };

  // 🟢 NEW: Delete Resource
  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm("Are you sure you want to delete this file/link?"))
      return;
    try {
      await deleteResourceAPI(resourceId);
      fetchResources(); // Refresh list after deletion
    } catch (err) {
      console.error("Failed to delete resource:", err);
      alert("Could not delete resource.");
    }
  };

  const handleFileClick = (item) => {
    const isDocx = item.url?.endsWith(".docx") || item.fileType === "docx";

    if (isDocx) {
      setPreviewDoc({ url: item.url, title: item.title });
    } else {
      window.open(item.url, "_blank");
    }
  };

  const handleExportGradebook = async () => {
    setIsExporting(true);
    setExportError("");
    try {
      const res = await getClassGradebookAPI(classId);
      const {
        classroomName,
        students,
        assignments: gbAssignments,
        submissions,
      } = res.data;

      const getScoreForCell = (studentId, assignmentId) => {
        const submission = submissions.find(
          (s) => s.studentId === studentId && s.assignmentId === assignmentId,
        );
        if (!submission) return "-";
        if (
          submission.finalScoreOverride !== null &&
          submission.finalScoreOverride !== undefined
        ) {
          return submission.finalScoreOverride;
        }
        return submission.aiEvaluation?.totalScoreGivenByAI ?? "Pending";
      };

      const sortedForExport = [...students].sort((a, b) =>
        compareRollNumbers(a.rollNumber, b.rollNumber),
      );

      const headerRow = [
        "Roll No",
        "Student Name",
        "Email",
        ...gbAssignments.map((a) => `${a.title} (/${a.totalMarks})`),
      ];

      const dataRows = sortedForExport.map((student) => [
        student.rollNumber || "-",
        student.name,
        student.email,
        ...gbAssignments.map((a) => getScoreForCell(student._id, a._id)),
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Gradebook");

      const safeName = (classroomName || "classroom").replace(/[^\w\-]+/g, "_");
      XLSX.writeFile(workbook, `${safeName}_Gradebook.xlsx`);
    } catch (err) {
      console.error("Failed to export gradebook:", err);
      setExportError(
        err.response?.data?.message || "Could not generate the gradebook.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-sm font-medium text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading classroom...</span>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Classroom not found.
        <button
          onClick={() => navigate("/")}
          className="block mx-auto mt-4 text-orange-600 font-bold text-xs"
        >
          ‹ Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-2.5 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* 🟢 MAIN CONTAINER */}
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:h-[calc(97vh-5rem)] lg:overflow-hidden">
        {/* ========================================== */}
        {/* LEFT COLUMN / SIDEBAR                      */}
        {/* ========================================== */}
        <div className="w-full lg:w-80 shrink-0 bg-white border border-slate-200 lg:border-orange-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-6 lg:h-full lg:overflow-y-auto">
          {/* Header Info */}
          <div className="space-y-4">
            <button
              onClick={() => navigate("/")}
              className="text-slate-400 hover:text-orange-600 font-bold text-sm transition-colors flex items-center gap-1"
            >
              ‹ Back to Dashboard
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-600 to-amber-500 text-white font-black text-lg flex items-center justify-center shadow-sm shrink-0">
                {classroom.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate leading-snug">
                  {classroom.name}
                </h2>
                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                  Join code:{" "}
                  <span className="font-mono font-bold text-orange-600">
                    {classroom.classCode}
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={handleExportGradebook}
              disabled={isExporting}
              className="w-full px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {isExporting ? "Generating..." : "📊 Export Gradebook"}
            </button>
          </div>

          <hr className="border-slate-100 hidden lg:block" />

          {/* Navigation Tabs (Teacher View - Identical to Student View) */}
          <div className="flex flex-row lg:flex-col gap-1 sm:gap-2 bg-orange-50/70 lg:bg-transparent p-1 lg:p-0 rounded-xl lg:rounded-none border lg:border-none border-orange-100/80 w-full">
            {/* 📋 Assignments / Pending Tab */}
            <button
              onClick={() => setActiveTab("assignments")}
              className={`flex-1 min-w-0 text-center lg:text-left px-0.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 text-[10px] sm:text-sm font-bold rounded-lg lg:rounded-xl transition-all flex items-center justify-center lg:justify-start gap-0.5 sm:gap-2 ${
                activeTab === "assignments"
                  ? "bg-white lg:bg-orange-50 text-orange-600 shadow-sm lg:shadow-none lg:border-l-4 lg:border-orange-600 font-extrabold"
                  : "text-slate-500 hover:text-slate-800 lg:hover:bg-slate-50"
              }`}
            >
              <span className="text-xs sm:text-sm shrink-0">📋</span>
              <span className="truncate">
                <span className="inline sm:hidden">
                  Tasks ({assignments.length})
                </span>
                <span className="hidden sm:inline">
                  Assignments ({assignments.length})
                </span>
              </span>
            </button>

            {/* 🎒 Students Tab */}
            <button
              onClick={() => setActiveTab("students")}
              className={`flex-1 min-w-0 text-center lg:text-left px-0.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 text-[10px] sm:text-sm font-bold rounded-lg lg:rounded-xl transition-all flex items-center justify-center lg:justify-start gap-0.5 sm:gap-2 ${
                activeTab === "students"
                  ? "bg-white lg:bg-orange-50 text-orange-600 shadow-sm lg:shadow-none lg:border-l-4 lg:border-orange-600 font-extrabold"
                  : "text-slate-500 hover:text-slate-800 lg:hover:bg-slate-50"
              }`}
            >
              <span className="text-xs sm:text-sm shrink-0">🎒</span>
              <span className="whitespace-nowrap">
                Students ({classroom.studentsEnrolled?.length || 0})
              </span>
            </button>

            {/* 📁 Files Tab */}
            <button
              onClick={() => setActiveTab("files")}
              className={`flex-1 min-w-0 text-center lg:text-left px-0.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 text-[10px] sm:text-sm font-bold rounded-lg lg:rounded-xl transition-all flex items-center justify-center lg:justify-start gap-0.5 sm:gap-2 ${
                activeTab === "files"
                  ? "bg-white lg:bg-orange-50 text-orange-600 shadow-sm lg:shadow-none lg:border-l-4 lg:border-orange-600 font-extrabold"
                  : "text-slate-500 hover:text-slate-800 lg:hover:bg-slate-50"
              }`}
            >
              <span className="text-xs sm:text-sm shrink-0">📁</span>
              <span className="truncate">
                <span className="inline sm:hidden">
                  Files ({resources.length})
                </span>
                <span className="hidden sm:inline">
                  Files & Resources ({resources.length})
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* RIGHT COLUMN / MAIN WINDOW                 */}
        {/* ========================================== */}
        <div className="flex-1 w-full bg-slate-50/80 lg:bg-white/70 border border-slate-200 lg:border-orange-100 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm lg:h-full lg:overflow-y-auto space-y-5 backdrop-blur-sm">
          {exportError && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-xl">
              ⚠️ {exportError}
            </div>
          )}

          {/* Assignments Tab Content */}
          {activeTab === "assignments" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl shadow-sm gap-3 sm:gap-4 text-center sm:text-left">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg md:text-2xl font-extrabold text-slate-900">
                    Classroom Assignments
                  </h3>
                  <p className="hidden lg:block text-xs text-slate-400 font-medium">
                    Manage and review all assigned work for this batch
                  </p>
                </div>
                <button
                  onClick={() => setIsEditorOpen(true)}
                  className="w-full sm:w-auto shrink-0 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all text-center"
                >
                  + New Assignment
                </button>
              </div>

              {isAssignmentsLoading ? (
                <div className="py-12 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200">
                  <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading assignments...</span>
                </div>
              ) : assignments.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-2">
                  <span className="text-3xl">📋</span>
                  <h4 className="text-sm font-bold text-slate-800">
                    No assignments yet
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Create your first assignment to start collecting and grading
                    student work.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a) => (
                    <div
                      key={a._id}
                      onClick={() => navigate(`/teacher/assignment/${a._id}`)}
                      className="bg-white border border-slate-200 hover:border-orange-300 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 transition-all shadow-sm hover:shadow cursor-pointer"
                    >
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-xl shrink-0 mt-0.5 sm:mt-0">
                          {a.modality === "Speech-Only" ? "🎙️" : "📝"}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-1">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate block w-full sm:w-auto">
                            {a.title}
                          </h4>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
                              {a.modality}
                            </span>
                            <span className="text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded shrink-0">
                              {a.totalMarks} Marks
                            </span>
                            {!a.isResultPublished && (
                              <span className="hidden sm:inline-block text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
                                Results Hidden
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 font-medium">
                            Due{" "}
                            {a.dueDate
                              ? new Date(a.dueDate).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "No deadline"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100/80">
                        <div>
                          {!a.isResultPublished && (
                            <span className="sm:hidden text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wide">
                              Results Hidden
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                          {a.submittedCount ?? 0} submitted
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Students Tab Content */}
          {activeTab === "students" && (
            <div className="space-y-4">
              <div className="border border-slate-200 lg:border-orange-100 p-4 rounded-2xl shadow-sm">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 text-center sm:text-left">
                  Enrolled Students
                </h3>
                <p className="text-xs text-slate-400 font-medium text-center sm:text-left">
                  {classroom.studentsEnrolled?.length || 0} active students in
                  this classroom
                </p>
              </div>

              {classroom.studentsEnrolled?.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-2">
                  <span className="text-3xl">🎒</span>
                  <h4 className="text-sm font-bold text-slate-800">
                    No students enrolled yet
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Share your join code{" "}
                    <span className="font-mono font-bold text-orange-600">
                      {classroom.classCode}
                    </span>{" "}
                    with students to get started.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-sm">
                  {sortedStudents.map((student) => (
                    <div
                      key={student._id}
                      className="flex items-center gap-4 p-4 sm:px-6 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                        {getInitials(student.name, "ST")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          <span className="font-mono text-orange-600 mr-1.5">
                            {student.rollNumber || "—"}
                          </span>
                          {student.name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {student.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 🟢 NEW: Files Tab Content */}
          {/* 🟢 FILES TAB CONTENT (Teacher View - Mobile Optimized) */}
          {activeTab === "files" && (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl shadow-sm gap-3 sm:gap-4 text-center sm:text-left bg-white border border-slate-200 lg:border-orange-100">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg md:text-2xl font-extrabold text-slate-900">
                    Classroom Files & Resources
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Upload reference files, PDFs, PPTs, or share Google Drive &
                    YouTube links
                  </p>
                </div>
                <button
                  onClick={() => setIsFileModalOpen(true)}
                  className="w-full sm:w-auto shrink-0 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all text-center"
                >
                  + Upload Resource
                </button>
              </div>

              {/* Content Window */}
              {isResourcesLoading ? (
                <div className="py-12 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200">
                  <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading resources...</span>
                </div>
              ) : resources.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-2">
                  <span className="text-3xl">📁</span>
                  <h4 className="text-sm font-bold text-slate-800">
                    No resources uploaded yet
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Share course materials, lecture slides, or external video
                    links with your class.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 sm:border-orange-100 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-sm">
                  {resources.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-3 sm:p-4 hover:bg-orange-50/50 transition-colors group"
                    >
                      {/* Clickable Info Area (Triggers handleFileClick) */}
                      <div
                        onClick={() => handleFileClick(item)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="text-lg sm:text-xl shrink-0 flex items-center justify-center w-6 sm:w-8">
                          {item.fileType === "youtube" && (
                            <Video className="w-5 h-5 text-red-600" />
                          )}
                          {item.fileType === "drive" && (
                            <Folder className="w-5 h-5 text-amber-500" />
                          )}
                          {item.resourceType === "file" && (
                            <FileText className="w-5 h-5 text-indigo-600" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800 sm:text-slate-900 group-hover:text-orange-600 transition-colors truncate leading-tight">
                            {item.title}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate mt-0.5">
                            Uploaded by {item.uploadedBy?.name || "Teacher"} •{" "}
                            {new Date(item.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                              },
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Actions: Desktop Open button + Delete icon */}
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
                        {/* Desktop Open Button */}
                        <button
                          type="button"
                          onClick={() => handleFileClick(item)}
                          className="hidden sm:inline-flex px-3.5 py-1.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all items-center gap-1"
                        >
                          <span>Open</span>
                          <span className="text-[10px]">↗</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevents triggering preview when deleting
                            handleDeleteResource(item._id);
                          }}
                          className="p-1.5 sm:px-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition-colors"
                          title="Delete File"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assignment Creation Modal */}
      {isEditorOpen && (
        <AssignmentEditorModal
          classId={classId}
          onClose={() => setIsEditorOpen(false)}
          onSaved={handleAssignmentSaved}
        />
      )}

      {/* 🟢 NEW: File/Link Upload Modal */}
      {isFileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Add Classroom Resource
              </h3>
              <button
                onClick={() => setIsFileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddResourceSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUploadType("file")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    uploadType === "file"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  📄 File Upload (PDF / DOC)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadType("link")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    uploadType === "link"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  🔗 Drive / Video Link
                </button>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Resource Display Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unit 1 Lecture Notes"
                  value={fileTitle || ""}
                  onChange={(e) => setFileTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              {/* Dynamic Input based on Type */}
              {uploadType === "file" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select File
                  </label>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files[0] || null;
                      setSelectedFile(file);
                      if (file && !fileTitle) setFileTitle(file.name || "");
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Google Drive or YouTube Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... or https://youtu.be/..."
                    value={linkUrl || ""}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFileModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResource}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  {isSubmittingResource ? "Saving..." : "Upload Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewDoc && (
        <DocxViewerModal
          fileUrl={previewDoc.url}
          title={previewDoc.title}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

export default ClassDetail;
