import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  loginUserAPI,
  registerUserAPI,
  verifyOtpAPI,
  forgotPasswordAPI,
  resetPasswordAPI,
} from "../services/api";
import assignbuddy_logo from "../assets/assignbuddy_logo.png";

// 👁️ Small inline SVG icons so we don't need an extra icon library dependency
function EyeIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      {...props}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      {...props}
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.94 10.94 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 1 13s4 8 11 8a10.94 10.94 0 0 0 5.11-1.27" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// 🟢 Reusable password input with a visibility ("eye") toggle baked in.
function PasswordField({ label, name, value, onChange, placeholder, extra }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          {label}
        </label>
        {extra}
      </div>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full h-9 md:h-11 pl-3 pr-10 text-sm md:text-base bg-orange-50/40 border border-orange-100 rounded-lg focus:bg-white focus:border-orange-400 focus:outline-none transition-colors"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-orange-600 focus:outline-none"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function Auth() {
  const { login } = useAuth();

  // View states: 'login' | 'register' | 'verify_otp' | 'forgot' | 'reset_password'
  const [viewMode, setViewMode] = useState("login");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    role: "student",
    rollNumber: "", // 🟢 NEW
    otp: "",
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMsg) setErrorMsg("");
    if (successMsg) setSuccessMsg("");
  };

  const executeFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (
      viewMode === "register" &&
      formData.password !== formData.confirmPassword
    ) {
      setErrorMsg("Passwords do not match. Please re-check both fields.");
      return;
    }
    if (
      viewMode === "reset_password" &&
      formData.newPassword !== formData.confirmNewPassword
    ) {
      setErrorMsg("Passwords do not match. Please re-check both fields.");
      return;
    }
    // 🟢 NEW: Roll number is required for student registrations, checked client-side
    // before hitting the network (the backend re-validates this too — never trust
    // client-side checks alone).
    if (
      viewMode === "register" &&
      formData.role === "student" &&
      !formData.rollNumber.trim()
    ) {
      setErrorMsg("Please enter your roll number.");
      return;
    }

    setIsSubmitting(true);

    try {
      let response;

      switch (viewMode) {
        case "login":
          response = await loginUserAPI({
            email: formData.email,
            password: formData.password,
          });
          break;
        case "register":
          response = await registerUserAPI({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            // 🟢 NEW: only meaningful for students; backend ignores it for teachers
            rollNumber:
              formData.role === "student" ? formData.rollNumber : undefined,
          });
          break;
        case "verify_otp":
          response = await verifyOtpAPI({
            email: formData.email,
            otp: formData.otp,
          });
          break;
        case "forgot":
          response = await forgotPasswordAPI({ email: formData.email });
          break;
        case "reset_password":
          response = await resetPasswordAPI({
            email: formData.email,
            otp: formData.otp,
            newPassword: formData.newPassword,
          });
          break;
        default:
          break;
      }

      const data = response.data;

      if (viewMode === "register") {
        setSuccessMsg(
          data.message ||
            "Registration initialized. Please check your VIT mail inbox.",
        );
        setViewMode("verify_otp");
      } else if (viewMode === "forgot") {
        setSuccessMsg("Verification recovery token sent to your email.");
        setViewMode("reset_password");
      } else if (viewMode === "reset_password") {
        setSuccessMsg("Password updated and encrypted. You can now log in.");
        setViewMode("login");
      } else if (viewMode === "login" || viewMode === "verify_otp") {
        const success = login(data.user, data.token);
        if (!success) {
          setErrorMsg(
            "Login response was incomplete — the app may not be reaching the real backend.",
          );
        }
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message ||
          err.message ||
          "Server rejected authentication request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8 font-sans antialiased text-slate-900">
      <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl bg-white border border-orange-100 rounded-2xl p-6 sm:p-8 md:p-12 lg:p-14 shadow-sm space-y-6 md:space-y-8">
        <div className="text-center space-y-1.5">
          {/* ✅ NEW RESPONSIVE LOGO */}
          <div className="flex justify-center mb-2">
            <img
              src={assignbuddy_logo}
              alt="AssignBuddy Logo"
              className="h-18 sm:h-14 md:h-16 lg:h-40 w-auto object-contain drop-shadow-sm transition-all duration-200"
            />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            {viewMode === "login" && "Sign in to your account"}
            {viewMode === "register" && "Create institutional profile"}
            {viewMode === "verify_otp" && "Verify your identity"}
            {viewMode === "forgot" && "Reset lost password"}
            {viewMode === "reset_password" && "Configure new credentials"}
          </h2>
          <p className="text-xs text-slate-500">
            Empowering Smarter Classrooms with AI
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-lg leading-relaxed">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-semibold rounded-lg leading-relaxed">
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={executeFormSubmit} className="space-y-4">
          {viewMode === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Rohit Sharma"
                className="w-full h-9 md:h-11 px-3 text-sm md:text-base bg-orange-50/40 border border-orange-100 rounded-lg focus:bg-white focus:border-orange-400 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* 🟢 NEW: Roll Number — only shown/required for student registrations.
              Placed right after Full Name so it reads naturally as part of identity. */}
          {viewMode === "register" && formData.role === "student" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Roll Number
              </label>
              <input
                type="text"
                name="rollNumber"
                required
                value={formData.rollNumber}
                onChange={handleInputChange}
                placeholder="e.g. 24102B0011"
                className="w-full h-9 md:h-11 px-3 text-sm md:text-base font-mono uppercase bg-orange-50/40 border border-orange-100 rounded-lg focus:bg-white focus:border-orange-400 focus:outline-none transition-colors"
              />
            </div>
          )}

          {(viewMode === "login" ||
            viewMode === "register" ||
            viewMode === "forgot") && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                VIT Email Address
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                placeholder="rohit.sharma@vit.edu.in"
                className="w-full h-9 md:h-11 px-3 text-sm md:text-base bg-orange-50/40 border border-orange-100 rounded-lg focus:bg-white focus:border-orange-400 focus:outline-none transition-colors"
              />
            </div>
          )}

          {(viewMode === "verify_otp" || viewMode === "reset_password") && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  6-Digit Verification Code
                </label>
                <span className="text-[10px] text-slate-400">
                  Sent to {formData.email}
                </span>
              </div>
              <input
                type="text"
                name="otp"
                required
                maxLength={6}
                value={formData.otp}
                onChange={handleInputChange}
                placeholder="000000"
                className="w-full h-9 md:h-11 px-3 text-sm md:text-base font-mono tracking-widest text-center bg-orange-50/40 border border-orange-100 rounded-lg focus:bg-white focus:border-orange-400 focus:outline-none transition-colors"
              />
            </div>
          )}

          {(viewMode === "login" || viewMode === "register") && (
            <PasswordField
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              extra={
                viewMode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg("");
                      setViewMode("forgot");
                    }}
                    className="text-xs text-orange-600 hover:underline font-medium focus:outline-none"
                  >
                    Forgot password?
                  </button>
                )
              }
            />
          )}

          {viewMode === "register" && (
            <PasswordField
              label="Confirm Password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="••••••••"
            />
          )}

          {viewMode === "reset_password" && (
            <PasswordField
              label="Configure New Password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleInputChange}
              placeholder="••••••••"
            />
          )}

          {viewMode === "reset_password" && (
            <PasswordField
              label="Confirm New Password"
              name="confirmNewPassword"
              value={formData.confirmNewPassword}
              onChange={handleInputChange}
              placeholder="••••••••"
            />
          )}

          {viewMode === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Campus Role Identity
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: "student" })}
                  className={`h-9 border text-sm font-semibold rounded-lg transition-all ${
                    formData.role === "student"
                      ? "bg-orange-50 border-orange-600 text-orange-600"
                      : "bg-orange-50/40 border-orange-100 text-slate-600 hover:bg-orange-50"
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: "teacher" })}
                  className={`h-9 border text-sm font-semibold rounded-lg transition-all ${
                    formData.role === "teacher"
                      ? "bg-orange-50 border-orange-600 text-orange-600"
                      : "bg-orange-50/40 border-orange-100 text-slate-600 hover:bg-orange-50"
                  }`}
                >
                  Instructor
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 mt-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 disabled:opacity-50 text-white font-bold text-sm rounded-full shadow-sm transition-all duration-150 flex items-center justify-center"
          >
            {isSubmitting
              ? "Processing Network Request..."
              : viewMode === "login"
                ? "Sign In"
                : viewMode === "register"
                  ? "Initialize Registration"
                  : viewMode === "verify_otp"
                    ? "Verify OTP Token"
                    : viewMode === "forgot"
                      ? "Send Reset Request"
                      : "Save New Password"}
          </button>
        </form>

        <div className="pt-4 border-t border-orange-100 text-center text-xs text-slate-600 space-y-2">
          {viewMode === "login" && (
            <p className="text-xs sm:text-sm md:text-base leading-relaxed">
              New to the platform? <br />
              <button
                type="button"
                onClick={() => {
                  setErrorMsg("");
                  setViewMode("register");
                }}
                className="text-orange-600 hover:underline font-bold focus:outline-none inline-block mt-1 sm:mt-0 sm:ml-1 transition-colors"
              >
                Create Account
              </button>
            </p>
          )}
          {viewMode !== "login" && (
            <p>
              Return to institutional access portal?{" "}
              <button
                type="button"
                onClick={() => {
                  setErrorMsg("");
                  setViewMode("login");
                }}
                className="text-orange-600 hover:underline font-bold focus:outline-none"
              >
                Sign In Here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;
