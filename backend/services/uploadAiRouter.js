import Groq from "groq-sdk";
import { GoogleGenAI, Type } from "@google/genai";
import aiConfig from "../config/ai.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  maxRetries: 1,
  timeout: 45000,
});
const gemini = aiConfig;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_WAIT_MS = 300_000; // 5-minute safety retry budget

const breaker = new Map();
const isDown = (name) => (breaker.get(name)?.until || 0) > Date.now();

function markDown(name, err) {
  if (err?.isValidation || err instanceof SyntaxError) return;
  const msg = String(err?.message || "").toLowerCase();
  let ms = 20_000;
  if (err?.status === 429) {
    const ra = Number(
      err.headers?.get?.("retry-after") ?? err.headers?.["retry-after"],
    );
    ms = msg.includes("per day") ? 3_600_000 : ra > 0 ? ra * 1000 : 20_000;
  }
  breaker.set(name, {
    until: Date.now() + ms,
    message: String(err?.message || err),
  });
  console.warn(
    `🔌 [Upload Breaker] ${name} paused for ${Math.round(ms / 1000)}s`,
  );
}

function normalizeUploadEvaluation(raw, criteriaMap) {
  const bad = (m) => Object.assign(new Error(m), { isValidation: true });

  // 🚨 Handle Separated Forensic Flags Triggered by AI Inspection
  if (raw.isScreenCapture === true) {
    throw Object.assign(
      new Error(
        `Fraud Detected [Screen Capture]: ${raw.fraudReason || "Submission is a photograph taken of a digital display/monitor screen."}`,
      ),
      { isValidation: true, fraudType: "screen_capture" },
    );
  }

  if (raw.isSyntheticHandwriting === true) {
    throw Object.assign(
      new Error(
        `Fraud Detected [Synthetic Handwriting]: ${raw.fraudReason || "Submission uses a printed text-to-handwriting font generator tool."}`,
      ),
      { isValidation: true, fraudType: "synthetic_handwriting" },
    );
  }

  if (!raw || typeof raw !== "object" || !raw.scores)
    throw bad("Missing scores");
  if (typeof raw.feedback !== "string" || !raw.feedback.trim())
    throw bad("Missing feedback");

  const scores = {};
  let total = 0;
  for (const [key, max] of Object.entries(criteriaMap)) {
    const val = Number(raw.scores[key]);
    if (!Number.isFinite(val)) throw bad(`Missing score for "${key}"`);
    scores[key] = Math.min(Math.max(val, 0), Number(max));
    total += scores[key];
  }
  return {
    ...raw,
    scores,
    totalScoreGivenByAI: Math.round(total * 100) / 100,
    transcribedText: raw.transcribedText || "", // 🟢 Pass along exact transcription
  };
}

async function runUploadChain(chain) {
  const deadline = Date.now() + MAX_WAIT_MS;
  const errors = {};
  let round = 0;

  while (Date.now() < deadline) {
    round++;
    for (const p of chain) {
      if (isDown(p.name)) {
        errors[p.name] ||= breaker.get(p.name)?.message;
        continue;
      }
      try {
        return await p.run();
      } catch (err) {
        errors[p.name] = err.message;
        console.warn(
          `⚠️ [Upload Round ${round}] ${p.name} failed: ${err.message}`,
        );
        markDown(p.name, err);
      }
    }

    const earliest = Math.min(
      ...chain.map((p) => breaker.get(p.name)?.until || 0),
    );
    const remaining = Math.max(deadline - Date.now(), 0);
    const waitMs = Math.min(
      Math.max(earliest - Date.now(), 3_000),
      15_000,
      remaining,
    );
    await sleep(waitMs);
  }

  const summary = Object.entries(errors)
    .map(([n, m]) => `${n}: ${String(m).slice(0, 250)}`)
    .join(" | ");
  throw new Error(
    `All AI upload evaluators failed or hit rate limits over 5 minutes. ${summary}`,
  );
}

/**
 * UPLOAD EVALUATION ROUTER WITH SEPARATED FORENSIC ANTI-CHEAT FLAGS
 */
export async function evaluateUploadWithRouter({
  question,
  files = [],
  criteriaMap,
  aiNotes = "",
}) {
  const criteriaString = JSON.stringify(criteriaMap);

  // Strict document check: PDFs and Word Docs route strictly to Gemini
  const hasDocument = files.some((f) => {
    const mime = f.mimetype?.toLowerCase() || "";
    const name = f.originalname?.toLowerCase() || "";
    return (
      mime.includes("pdf") ||
      mime.includes("wordprocessingml") ||
      mime.includes("msword") ||
      name.endsWith(".pdf") ||
      name.endsWith(".docx") ||
      name.endsWith(".doc")
    );
  });

  const fileParts = files.map((file) => ({
    inlineData: {
      data: file.buffer.toString("base64"),
      mimeType: file.mimetype || "application/octet-stream",
    },
  }));

  // 🛡️ SYSTEM PROMPT WITH SEPARATED FORENSIC CATEGORIES & TEXT TRANSCRIPTION
  const systemPrompt = `
    You are an expert forensic document examiner and a strict academic professor.
    Before grading content, perform two independent forensic checks on the image/document:
    1. isScreenCapture: Set to true ONLY if the image is a physical photograph of a laptop, phone, or monitor screen (exhibiting Moiré interference waves, RGB subpixel display grids, or monitor borders). Otherwise false.
    2. isSyntheticHandwriting: Set to true ONLY if the text appears to be created via a digital text-to-handwriting font generator tool and printed out on paper (exhibiting 100% identical repeating letter glyphs, flat laser printer ink density, or rigid machine-like baseline tracking). Otherwise false.

    If either is true, provide a brief description in "fraudReason".

    CRITICAL ACADEMIC EVALUATION & TRANSCRIPTION RULES:
    - Carefully read the "Target Question" and "Teacher Notes & Focus".
    - Inspect the student's uploaded handwritten work. 
    - Transcribe the exact text and answers written by the student across ALL provided pages/files into a single clean continuous string under "transcribedText".
    - Verify whether the student's submission actually addresses and answers the specific prompt or questions asked. 
    - If the student has written about an entirely different topic, submitted unrelated notes, or failed to answer the requested questions, you MUST heavily penalize them or award 0 points, and explicitly state in the feedback that the submission does not answer the assignment prompt.

    If legitimate and relevant, grade the work strictly against the rubric criteria weights, compute the exact total, and provide feedback.
    Return strict JSON matching:
    {
        "isScreenCapture": boolean,
        "isSyntheticHandwriting": boolean,
        "fraudReason": "string (optional)",
        "transcribedText": "string",
        "scores": { [criterionName]: number },
        "totalScoreGivenByAI": number,
        "feedback": "string"
    }
    `;

  const textPrompt = `
Target Question: "${question}"
Rubric Criteria Map: ${criteriaString}
${aiNotes ? `Teacher Notes & Focus: "${aiNotes}"` : ""}
`;

  const dynamicScoreProperties = {};
  const scoreRequiredFields = [];
  Object.keys(criteriaMap).forEach((key) => {
    dynamicScoreProperties[key] = { type: Type.NUMBER };
    scoreRequiredFields.push(key);
  });

  const chain = [];

  // If image-only, try Groq Qwen Vision first
  if (!hasDocument) {
    chain.push({
      name: "groq-qwen",
      run: async () => {
        console.log(
          "⚡ [Groq Engine] Attempting image evaluation & separated forensic check via Qwen vision...",
        );
        const groqContent = [
          {
            type: "text",
            text: `${systemPrompt}\n${textPrompt}\nPerform forensic evaluation, grade student work, and return JSON.`,
          },
          ...files.map((file) => ({
            type: "image_url",
            image_url: {
              url: `data:${file.mimetype || "image/jpeg"};base64,${file.buffer.toString("base64")}`,
            },
          })),
        ];

        const completion = await groq.chat.completions.create({
          model: "qwen/qwen3.8-27b",
          messages: [{ role: "user", content: groqContent }],
          response_format: { type: "json_object" },
          temperature: 0.1,
        });

        const parsed = JSON.parse(completion.choices[0].message.content);
        return {
          provider: "groq-qwen",
          ...normalizeUploadEvaluation(parsed, criteriaMap),
        };
      },
    });
  } else {
    console.log(
      "📄 [Upload Router] Document (PDF/Word) detected. Routing strictly through Gemini RPD-ordered chain...",
    );
  }

  // Gemini Fallback Chain (Decreasing RPD: 500 RPD Flash Lites first[cite: 2, 3], then 20 RPD Flash models[cite: 2, 3])
  const geminiModels = [
    { name: "gemini-3.1-flash-lite", model: "gemini-3.1-flash-lite" }, // 500 RPD[cite: 2, 3]
    { name: "gemini-3.5-flash-lite", model: "gemini-3.5-flash-lite" }, // 500 RPD[cite: 2, 3]
    { name: "gemini-3.6-flash", model: "gemini-3.6-flash" }, // 20 RPD[cite: 2, 3]
    { name: "gemini-3.8-flash", model: "gemini-3.8-flash" }, // 20 RPD[cite: 2, 3]
    { name: "gemini-3.7-flash", model: "gemini-3.7-flash" }, // 20 RPD[cite: 2, 3]
    { name: "gemini-2.5-flash", model: "gemini-2.5-flash" }, // 20 RPD[cite: 2, 3]
    { name: "gemini-3-flash", model: "gemini-3-flash" }, // 20 RPD[cite: 2, 3]
  ];

  for (const gm of geminiModels) {
    chain.push({
      name: gm.name,
      run: async () => {
        console.log(
          `🔄 [Gemini Chain] Attempting separated forensic check & evaluation via model: ${gm.model}...`,
        );
        const response = await gemini.models.generateContent({
          model: gm.model,
          contents: [...fileParts, `${systemPrompt}\n${textPrompt}`],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isScreenCapture: { type: Type.BOOLEAN },
                isSyntheticHandwriting: { type: Type.BOOLEAN },
                fraudReason: { type: Type.STRING },
                transcribedText: { type: Type.STRING },
                scores: {
                  type: Type.OBJECT,
                  properties: dynamicScoreProperties,
                  required: scoreRequiredFields,
                },
                totalScoreGivenByAI: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
              },
              required: [
                "isScreenCapture",
                "isSyntheticHandwriting",
                "transcribedText",
                "scores",
                "totalScoreGivenByAI",
                "feedback",
              ],
            },
          },
        });

        const parsed = JSON.parse(response.text);
        return {
          provider: gm.name,
          ...normalizeUploadEvaluation(parsed, criteriaMap),
        };
      },
    });
  }

  return await runUploadChain(chain);
}
