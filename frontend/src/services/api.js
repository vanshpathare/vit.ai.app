import axios from "axios";

// 🌐 Create a unified base routing pipeline pointing to your Node server
const API = axios.create({
  baseURL: "http://localhost:5001/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔒 AUTOMATIC SECURITY INTERCEPTOR:
// Injects the logged-in user's Bearer token into headers automatically
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// ⚡ CLEAN EXPORTED ENDPOINT WRAPPERS:
export const registerUserAPI = (data) => API.post("/auth/register", data);
export const verifyOtpAPI = (data) => API.post("/auth/verify-otp", data);
export const loginUserAPI = (data) => API.post("/auth/login", data);

// 🏫 CLASSROOM MANAGEMENT (shared + teacher)
export const joinClassroomAPI = (joinCode) =>
  API.post("/class/join", { classCode: joinCode });
export const getStudentDashboardAPI = () => API.get("/class/my-classes");
// 🟢 NEW: Clearer alias for teacher usage of the same endpoint
export const getMyClassroomsAPI = () => API.get("/class/my-classes");
// 🟢 NEW: Teacher creates a brand new classroom (gets back a join code)
export const createClassroomAPI = (data) => API.post("/class/create", data);
// 🟢 NEW: Fetch a single classroom's full roster + metadata
export const getClassroomDetailsAPI = (classId) => API.get(`/class/${classId}`);
// 🟢 NEW: Fetch gradebook data (roster + assignments + graded submissions) for Excel export
export const getClassGradebookAPI = (classId) =>
  API.get(`/class/${classId}/gradebook`);

// 📋 ASSIGNMENT MANAGEMENT (shared + teacher)
export const getClassAssignmentsAPI = (classId) =>
  API.get(`/assignments/class/${classId}`);
export const initializeSubmissionAPI = (assignmentId) =>
  API.post("/assignments/initialize", { assignmentId });
// 🟢 NEW: Teacher creates a new assignment for a classroom
export const createAssignmentAPI = (data) =>
  API.post("/assignments/create", data);
// 🟢 NEW: Fetch full detail (question pool, criteria, classId) for one assignment
export const getAssignmentByIdAPI = (assignmentId) =>
  API.get(`/assignments/${assignmentId}`);
// 🟢 NEW: Update any subset of an assignment's settings/questions/criteria
export const updateAssignmentAPI = (assignmentId, data) =>
  API.put(`/assignments/${assignmentId}`, data);
// 🟢 NEW: Toggle whether students can see their numeric grades yet
export const toggleResultPublishAPI = (assignmentId, isResultPublished) =>
  API.put(`/assignments/${assignmentId}/publish`, { isResultPublished });
// 🟢 NEW: Upload a reference document and let Gemini draft a question pool from it
export const generateQuestionsFromMaterialAPI = (formData) =>
  API.post("/assignments/generate-from-material", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// 📊 SUBMISSIONS & GRADING (shared + teacher)
export const getSubmissionDetailsAPI = (submissionId) =>
  API.get(`/submissions/${submissionId}`);
export const submitAssignmentAPI = (formData, config = {}) =>
  API.post("/submissions/execute", formData, config);
export const logInfractionAPI = (submissionId) =>
  API.patch(`/submissions/log-infraction/${submissionId}`);
// 🟢 NEW: Teacher fetches every submission row for a given assignment
export const getAssignmentSubmissionsAPI = (assignmentId, status) =>
  API.get(`/submissions/assignment/${assignmentId}`, {
    params: status ? { status } : {},
  });
// 🟢 NEW: Teacher manually overrides a student's AI-given score
export const overrideSubmissionScoreAPI = (submissionId, finalScoreOverride) =>
  API.put(`/submissions/override/${submissionId}`, { finalScoreOverride });

export default API;
