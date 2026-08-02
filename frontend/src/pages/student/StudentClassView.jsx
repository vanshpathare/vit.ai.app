import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getClassroomDetailsAPI,
  getClassAssignmentsAPI,
  initializeSubmissionAPI,
  getClassroomResourcesAPI,
} from "../../services/api";
import { getSubjectIcon } from "../../utils/subjectIcons";
import { Video, Folder, FileText } from "lucide-react";
import { getPreviewUrl } from "../../utils/getPreviewUrl";
import DocxViewerModal from "../../components/DocxViewerModal";
import AssignmentBriefingModal from "../../components/AssignmentBriefingModal";

const getAttachmentIcon = (fileType, url) => {
  if (
    fileType === "youtube" ||
    url?.includes("youtube") ||
    url?.includes("youtu.be")
  ) {
    return <Video className="w-3.5 h-3.5 text-red-600 shrink-0" />;
  }
  if (fileType === "drive" || url?.includes("drive.google.com")) {
    return <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
  return <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
};

function StudentClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [resources, setResources] = useState([]);

  // 🟢 RESTORED: assignmentFilter state variable
  const [assignmentFilter, setAssignmentFilter] = useState("pending");
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' | 'completed' | 'files'

  const [isLoading, setIsLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false);

  const [previewDoc, setPreviewDoc] = useState(null);

  const [briefingAssignment, setBriefingAssignment] = useState(null);
  const [isLaunchingWorkspace, setIsLaunchingWorkspace] = useState(false);

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
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const handleViewAssignment = async (assignmentId) => {
    try {
      const response = await initializeSubmissionAPI(assignmentId);
      const targetSubmissionId = response.data.submissionId;
      const modality = response.data.modality || "Text-Only";

      if (modality === "Speech-Only") {
        navigate(`/student/viva-workspace/${targetSubmissionId}`);
      } else {
        navigate(`/student/text-workspace/${targetSubmissionId}`);
      }
    } catch (err) {
      console.error("Failed to launch assignment workspace:", err);
      alert(
        err.response?.data?.message || "Could not launch assignment workspace.",
      );
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

  const handleStartClick = (task) => {
    if (task.status === "submitted") {
      handleConfirmLaunch(task._id);
      return;
    }
    setBriefingAssignment(task);
  };

  //  Actual API call & Navigation after user confirms in briefing modal
  const handleConfirmLaunch = async (assignmentId) => {
    try {
      setIsLaunchingWorkspace(true);
      const response = await initializeSubmissionAPI(assignmentId);
      const targetSubmissionId = response.data.submissionId;
      const modality = response.data.modality || "Text-Only";

      setBriefingAssignment(null); // Close briefing modal

      if (modality === "Speech-Only") {
        navigate(`/student/viva-workspace/${targetSubmissionId}`);
      } else {
        navigate(`/student/text-workspace/${targetSubmissionId}`);
      }
    } catch (err) {
      console.error("Failed to launch assignment workspace:", err);
      alert(
        err.response?.data?.message || "Could not launch assignment workspace.",
      );
    } finally {
      setIsLaunchingWorkspace(false);
    }
  };

  // 🟢 RESTORED: Original assignment filter condition using assignmentFilter
  const filteredAssignments = assignments.filter((item) => {
    if (assignmentFilter === "completed") {
      return item.status === "submitted" || item.status === "completed";
    }
    return item.status !== "submitted" && item.status !== "completed";
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-sm font-medium text-slate-400 gap-2">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
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

  const subject = getSubjectIcon(classroom.subjectIcon);
  const pendingCount = assignments.filter(
    (a) => a.status !== "submitted" && a.status !== "completed",
  ).length;
  const completedCount = assignments.filter(
    (a) => a.status === "submitted" || a.status === "completed",
  ).length;

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    if (tabName === "pending" || tabName === "completed") {
      setAssignmentFilter(tabName);
    }
  };

  return (
    <div className="w-full px-1.5 sm:px-2 lg:px-8 py-4 sm:py-6">
      {/* MAIN CONTAINER */}
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:h-[calc(97vh-5rem)] lg:overflow-hidden">
        {/* LEFT COLUMN / SIDEBAR */}
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
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${subject.gradient} text-white font-bold text-lg flex items-center justify-center shadow-sm shrink-0`}
              >
                {classroom.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate leading-snug">
                  {classroom.name}
                </h2>
                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                  Prof: {classroom.teacherId?.name || "Faculty Coordinator"}
                </p>
              </div>
            </div>
          </div>

          <hr className="border-slate-100 hidden lg:block" />

          {/* Navigation Tabs */}
          {/* Navigation Tabs (Mobile Optimized: 3 columns grid/flex, scroll-safe, zero layout breaks) */}
          <div className="flex flex-row lg:flex-col gap-1 sm:gap-2 bg-orange-50/70 lg:bg-transparent p-1 lg:p-0 rounded-xl lg:rounded-none border lg:border-none border-orange-100/80 w-full">
            <button
              onClick={() => handleTabChange("pending")}
              className={`flex-1 min-w-0 text-center lg:text-left px-0.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 text-[10px] sm:text-sm font-bold rounded-lg lg:rounded-xl transition-all flex items-center justify-center lg:justify-start gap-0.5 sm:gap-2 ${
                activeTab === "pending"
                  ? "bg-white lg:bg-orange-50 text-orange-600 shadow-sm lg:shadow-none lg:border-l-4 lg:border-orange-600 font-extrabold"
                  : "text-slate-500 hover:text-slate-800 lg:hover:bg-slate-50"
              }`}
            >
              <span className="text-xs sm:text-sm shrink-0">⏳</span>
              <span className="whitespace-nowrap">
                Pending ({pendingCount})
              </span>
            </button>

            <button
              onClick={() => handleTabChange("completed")}
              className={`flex-1 min-w-0 text-center lg:text-left px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold rounded-lg lg:rounded-xl transition-all flex items-center justify-center lg:justify-start gap-1 sm:gap-2 ${
                activeTab === "completed"
                  ? "bg-white lg:bg-orange-50 text-orange-600 shadow-sm lg:shadow-none lg:border-l-4 lg:border-orange-600 font-extrabold"
                  : "text-slate-500 hover:text-slate-800 lg:hover:bg-slate-50"
              }`}
            >
              <span className="text-xs sm:text-sm shrink-0">✅</span>
              <span className="truncate">Done ({completedCount})</span>
            </button>

            <button
              onClick={() => handleTabChange("files")}
              className={`flex-1 min-w-0 text-center lg:text-left px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold rounded-lg lg:rounded-xl transition-all flex items-center justify-center lg:justify-start gap-1 sm:gap-2 ${
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
                  Files & Notes ({resources.length})
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN / SCROLLABLE CONTENT WINDOW */}
        <div className="flex-1 w-full bg-slate-50/80 lg:bg-white/70 border border-slate-200 lg:border-orange-100 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm lg:h-full lg:overflow-y-auto space-y-5 backdrop-blur-sm">
          {/* ASSIGNMENTS VIEW */}
          {activeTab !== "files" && (
            <>
              <div className="p-4 rounded-2xl shadow-sm">
                <h3 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 capitalize">
                  {assignmentFilter} Assignments
                </h3>
                <p className="hidden lg:block text-xs text-slate-400 font-medium">
                  Stay on track with your upcoming tasks and deadlines
                </p>
              </div>

              {isAssignmentsLoading ? (
                <div className="py-16 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Syncing channel feed loops...</span>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="bg-orange-50/40 border border-dashed border-orange-200 rounded-2xl p-12 text-center space-y-2">
                  <span className="text-2xl select-none">🎉</span>
                  <h4 className="text-sm font-bold text-slate-800">
                    This feed is clear
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
                    No assignments match your active status filters inside this
                    workspace.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {filteredAssignments.map((task) => (
                    <div
                      key={task._id}
                      className="bg-white border border-orange-100 hover:border-orange-200 rounded-2xl p-4 sm:p-6 flex flex-col gap-4 transition-all shadow-sm"
                    >
                      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-sm">
                          {task.modality === "Speech-Only" ? "🎙️" : "📝"}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight break-words">
                              {task.title}
                            </h4>
                            {task.status === "ongoing" && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full tracking-wide shrink-0">
                                In Progress
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] sm:text-xs font-black bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full tracking-wider uppercase border border-orange-100">
                              {task.modality || "Text-Only"}
                            </span>
                            <span className="text-xs sm:text-sm text-slate-500 font-semibold">
                              Marks:{" "}
                              <span className="text-orange-600 font-bold">
                                {task.totalMarks}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-orange-100 pt-4 flex-wrap sm:flex-nowrap">
                        {/* Due Date Badge */}
                        <span className="text-xs sm:text-sm font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-full shadow-sm flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                          ⏰{" "}
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                },
                              )
                            : "No limit"}
                        </span>

                        {/* 🟢 LAPTOP & TABLET VIEW: Attachments fit into the middle space */}
                        {task.attachments && task.attachments.length > 0 && (
                          <div className="hidden sm:flex items-center gap-2 flex-1 min-w-0 overflow-x-auto py-0.5 px-1 scrollbar-none">
                            {task.attachments.map((att, idx) => (
                              <button
                                key={att._id || idx}
                                onClick={() => handleFileClick(att)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-600 border border-slate-200 hover:border-orange-200 rounded-xl text-xs font-bold transition-all shrink-0 max-w-[200px]"
                                title={
                                  att.fileName || att.title || "Attachment"
                                }
                              >
                                {getAttachmentIcon(att.fileType, att.url)}
                                <span className="truncate">
                                  {att.fileName || att.title || "Attachment"}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Action Button */}
                        <button
                          onClick={() => handleStartClick(task)}
                          className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-xs sm:text-base font-bold rounded-full shadow transition-all whitespace-nowrap"
                        >
                          {task.status === "submitted"
                            ? "View Results"
                            : task.status === "ongoing"
                              ? "Resume Test"
                              : "Start Assignment"}
                        </button>
                      </div>

                      {/* 🟢 3. MOBILE VIEW: Attachments stack below the action buttons */}
                      {task.attachments && task.attachments.length > 0 && (
                        <div className="flex sm:hidden flex-col gap-1.5 pt-1 border-t border-dashed border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            Attachments ({task.attachments.length}):
                          </span>
                          {task.attachments.map((att, idx) => (
                            <div
                              key={att._id || idx}
                              onClick={() => handleFileClick(att)}
                              className="flex items-center justify-between p-2.5 bg-orange-50/50 hover:bg-orange-50 border border-orange-100 rounded-xl group cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {getAttachmentIcon(att.fileType, att.url)}
                                <span className="text-xs font-bold text-slate-800 group-hover:text-orange-600 truncate">
                                  {att.fileName || att.title || "Attachment"}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-orange-600 shrink-0 ml-2">
                                ↗
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* FILES TAB */}
          {activeTab === "files" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl shadow-sm bg-white border border-slate-200 lg:border-orange-100">
                <h3 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900">
                  Classroom Resources & Study Material
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Access lecture notes, reference PDFs, and external links
                  shared by your professor
                </p>
              </div>

              {isResourcesLoading ? (
                <div className="py-16 text-center text-xs font-medium text-slate-400 flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Fetching study materials...</span>
                </div>
              ) : resources.length === 0 ? (
                <div className="bg-orange-50/40 border border-dashed border-orange-200 rounded-2xl p-12 text-center space-y-2">
                  <span className="text-3xl select-none">📁</span>
                  <h4 className="text-sm font-bold text-slate-800">
                    No files shared yet
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
                    Your teacher has not uploaded any study material or
                    reference links for this class yet.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 sm:border-orange-100 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-sm">
                  {resources.map((item) => (
                    <div
                      key={item._id}
                      // href={getPreviewUrl(item.url)}
                      onClick={() => handleFileClick(item)}
                      //target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 sm:p-4 hover:bg-orange-50/50 transition-colors group cursor-pointer"
                    >
                      {/* Icon + Main Info */}
                      <div className="flex items-center gap-3 min-w-0">
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

                      {/* Action Element: Hidden button on mobile (whole row opens link), visible on desktop */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {/* Desktop Button */}
                        <span className="hidden sm:inline-flex px-3.5 py-1.5 bg-gradient-to-r from-orange-600 to-amber-500 group-hover:from-orange-700 group-hover:to-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all items-center gap-1">
                          <span>Open</span>
                          <span className="text-[10px]">↗</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {previewDoc && (
        <DocxViewerModal
          fileUrl={previewDoc.url}
          title={previewDoc.title}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {briefingAssignment && (
        <AssignmentBriefingModal
          assignment={briefingAssignment}
          onClose={() => setBriefingAssignment(null)}
          onConfirmStart={handleConfirmLaunch}
          isInitializing={isLaunchingWorkspace}
        />
      )}
    </div>
  );
}

export default StudentClassView;
