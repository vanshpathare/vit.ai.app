// utils/cacheUtils.js
import redisClient from "../config/redis.js";
import Assignment from "../models/Assignment.js";

/**
 * Resilient Redis-cached assignment fetcher with automatic MongoDB fallback.
 */
export async function getCachedAssignment(assignmentId) {
  const cacheKey = `assignment:${assignmentId}`;

  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(
        `⚡ [Cache Hit] Loaded assignment ${assignmentId} from Redis`,
      );
      return JSON.parse(cachedData);
    }
  } catch (redisError) {
    console.warn(
      `⚠️ [Redis Warning] Cache read failed (${redisError.message}). Falling back to MongoDB.`,
    );
  }

  // Fallback to MongoDB
  console.log(
    `🗄️ [Database Fetch] Fetching assignment ${assignmentId} from MongoDB`,
  );
  const assignment = await Assignment.findById(assignmentId).lean();
  if (!assignment) return null;

  try {
    // Non-blocking cache store with 1-hour TTL
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(assignment));
  } catch (redisError) {
    console.warn(
      `⚠️ [Redis Warning] Cache write failed (${redisError.message}). Continuing normally.`,
    );
  }

  return assignment;
}

/**
 * Optional: Helper to invalidate/clear cache when a teacher updates an assignment
 */
export async function invalidateAssignmentCache(assignmentId) {
  try {
    await redisClient.del(`assignment:${assignmentId}`);
    console.log(
      `🗑️ [Cache Cleared] Invalidated cache for assignment ${assignmentId}`,
    );
  } catch (err) {
    console.warn(
      `⚠️ [Redis Warning] Failed to invalidate cache: ${err.message}`,
    );
  }
}
