import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// 🚀 IMPORT YOUR ROUTE GATEWAYS
import authRoutes from "./routes/authRoutes.js";
import classRoutes from "./routes/classRoutes.js";
import assignRoutes from "./routes/assignRoutes.js";
import submitRoutes from "./routes/submitRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 🔗 LINK YOUR ROUTES TO EXTENDED API URL PATHS
app.use("/api/auth", authRoutes);
app.use("/api/class", classRoutes);
app.use("/api/assignments", assignRoutes);
app.use("/api/submissions", submitRoutes);

// Basic Route for testing
app.get("/", (req, res) => {
  res.send("🚀 LangAI Backend API is running smoothly!");
});

const PORT = process.env.PORT || 5001;

// Connect to Database before opening port listener
connectDB();

app.listen(PORT, () => {
  console.log(`📡 Server running in development mode on port ${PORT}`);
});
