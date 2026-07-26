// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import connectDB from "./config/db.js";

// // 🚀 IMPORT YOUR ROUTE GATEWAYS
// import authRoutes from "./routes/authRoutes.js";
// import classRoutes from "./routes/classRoutes.js";
// import assignRoutes from "./routes/assignRoutes.js";
// import submitRoutes from "./routes/submitRoutes.js";

// dotenv.config();

// const app = express();

// //const CLIENT_ORIGIN = "https://vit-ai-app.onrender.com";

// const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
//   .split(",")
//   .map((origin) => origin.trim())
//   .filter(Boolean);

// // Middleware
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       // Allow tools like curl/Postman (no origin header) and any origin on the list
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error(`CORS blocked for origin: ${origin}`));
//       }
//     },
//   }),
// );

// app.use(express.json());

// // 🔗 LINK YOUR ROUTES TO EXTENDED API URL PATHS
// app.use("/api/auth", authRoutes);
// app.use("/api/class", classRoutes);
// app.use("/api/assignments", assignRoutes);
// app.use("/api/submissions", submitRoutes);

// // Basic Route for testing
// app.get("/", (req, res) => {
//   res.send("🚀 LangAI Backend API is running smoothly!");
// });

// const PORT = process.env.PORT || 5001;

// // Connect to Database before opening port listener
// connectDB();

// app.listen(PORT, () => {
//   console.log(`📡 Server running in development mode on port ${PORT}`);
// });

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

// 🔒 CORS is configured entirely via the CLIENT_ORIGIN env var (set this in Render's
// Environment tab, comma-separated if you have multiple frontend origins to allow).
// 🟢 NEW: strips any trailing "/" from each origin so a stray trailing slash in the
// env var value (or in the browser's Origin header) can't cause a false mismatch —
// browsers never send a trailing slash in the Origin header, but it's an easy typo
// to make when copy-pasting a URL into Render's dashboard.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

// 🟢 NEW: Diagnostic log so you can see EXACTLY what the server parsed CLIENT_ORIGIN
// into, straight from Render's log output — removes all guessing about whether the
// env var is set correctly. Check this line in the logs after every deploy.
console.log("🔍 CORS allowedOrigins parsed as:", allowedOrigins);
console.log(
  "🔍 Raw CLIENT_ORIGIN env var value:",
  JSON.stringify(process.env.CLIENT_ORIGIN),
);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow tools like curl/Postman (no origin header) and any origin on the list
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        callback(null, true);
      } else {
        console.warn(
          `⚠️ CORS blocked for origin: "${origin}" — allowed list is:`,
          allowedOrigins,
        );
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
  }),
);

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
  console.log(`📡 Server running on port ${PORT}`);
});
