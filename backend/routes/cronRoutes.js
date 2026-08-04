// routes/cronRoutes.js
import express from "express";
const router = express.Router();

router.get("/daily-cleanup", async (req, res) => {
  try {
    // 🔒 Security Check
    const cronSecret = req.headers["x-cron-secret"];
    if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: "Unauthorized cron trigger" });
    }

    // ⚙️ Perform your scheduled task here
    console.log("⏰ Running daily maintenance job...");

    // Example: Clean up expired sessions, archive old logs, sync statuses
    // await cleanupExpiredTokens();

    return res
      .status(200)
      .json({ success: true, message: "Cron executed successfully" });
  } catch (error) {
    console.error("❌ Cron job failed:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
