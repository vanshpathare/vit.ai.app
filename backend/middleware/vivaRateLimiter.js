// middleware/vivaRateLimiter.js
import redisClient from "../config/redis.js";

export async function vivaRateLimiter(req, res, next) {
  try {
    const studentId = req.user?._id || req.body.studentId; // Adjust based on your auth middleware
    if (!studentId) return next();

    const cooldownKey = `cooldown:viva:${studentId}`;

    // Check if a lock exists
    const existingLock = await redisClient.get(cooldownKey);
    if (existingLock) {
      return res.status(429).json({
        message:
          "Please wait a moment before sending your next voice response.",
      });
    }

    // Set a 3-second lock expire time
    await redisClient.setEx(cooldownKey, 3, "locked");
    next();
  } catch (err) {
    console.error("Rate limiter error:", err);
    next(); // Fail open if Redis hiccups so the student isn't blocked
  }
}
