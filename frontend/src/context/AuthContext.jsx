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
      // Clean up corrupted keys even if the `if` above didn't run (e.g. only one
      // of the two keys got corrupted) so they don't linger indefinitely.
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
  };

  // Handle Logout Clean Sweeps
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
