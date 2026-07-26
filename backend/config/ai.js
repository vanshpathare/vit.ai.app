import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Ensure environment variables are loaded if accessing this node early in execution
dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "⚠️ WARNING: GEMINI_API_KEY environment variable is not defined in your .env configuration.",
  );
}

// 🤖 INITIALIZE THE REUSABLE GEMINI CLIENT INSTANCE
// Using the official current @google/genai package architecture
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default ai;
