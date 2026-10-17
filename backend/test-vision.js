import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testPdfAnalysis() {
  // Make sure your PDF is named 'sample.pdf' inside the backend folder
  const pdfPath = "./sample.pdf";

  if (!fs.existsSync(pdfPath)) {
    console.error(
      "❌ Error: Please place 'sample.pdf' inside your backend folder first!",
    );
    return;
  }

  try {
    console.log("⏳ Reading PDF file and converting to base64...");
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64Pdf = pdfBuffer.toString("base64");

    console.log(
      "⏳ Sending PDF to Gemini (gemini-3.1-flash-lite) for analysis...",
    );
    const startTime = Date.now();

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite", // You can also swap to gemini-3.5-flash-lite if preferred
      contents: [
        {
          inlineData: {
            data: base64Pdf,
            mimeType: "application/pdf",
          },
        },
        "Analyze this operating systems exam solution PDF. Extract the main questions, answers, and summarize the core topics covered across the pages.",
      ],
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `\n✅ [PDF Analysis Result Successfully Received in ${duration}s]:\n`,
    );
    console.log(response.text);
  } catch (error) {
    console.error("❌ Error analyzing PDF:", error.message);
  }
}

testPdfAnalysis();
