import React, { createContext, useState, useEffect, useContext } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync token from localStorage on initial render boot
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser && storedUser !== "undefined") {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse stored user, clearing session:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    } else if (storedUser === "undefined" || storedToken === "undefined") {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }

    setLoading(false);
  }, []);

  // Handle Login State Mutations
  const login = (userData, token) => {
    if (!userData || !token) {
      console.error(
        "login() called with incomplete data — refusing to persist a broken session.",
        { userData, token },
      );
      return false;
    }

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return true;
  };

  // 🟢 NEW: Patches fields on the currently logged-in user (e.g. after a student adds
  // their roll number via Account.jsx) without needing a full re-login. Merges into
  // both React state and localStorage so a page refresh doesn't lose the update.
  const updateUser = (partialUserData) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partialUserData };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  // Handle Logout Clean Sweeps
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
