import jwt from "jsonwebtoken";
import User from "../models/User.js";

// 1. GUARDIAN: Verifies the user has a valid, active login token
export const protect = async (req, res, next) => {
  let token;

  // Check if token exists in the request headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Extract token out of the "Bearer <token>" string format
      token = req.headers.authorization.split(" ")[1];

      // Decode and verify the token signature using your JWT_SECRET
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch the full user from the database (excluding their encrypted password)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res
          .status(401)
          .json({ message: "User session no longer exists." });
      }

      // Everything looks good! Move to the actual controller logic
      next();
    } catch (error) {
      return res
        .status(401)
        .json({
          message: "Session expired or token invalid. Please log in again.",
        });
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. Security token missing." });
  }
};

// 2. ROLE GUARD: Restricts access strictly to Verified Teachers
export const teacherOnly = (req, res, next) => {
  // Checks the role attached to the request session by the 'protect' middleware above
  if (req.user && req.user.role === "teacher") {
    next(); // Access granted, proceed to execution
  } else {
    res
      .status(403)
      .json({
        message:
          "Access restricted. This endpoint requires a Teacher account role.",
      });
  }
};
