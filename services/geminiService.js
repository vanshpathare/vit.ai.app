import { Type } from "@google/genai";
import ai from "../config/ai.js"; // ◄── UPDATED: Centralized config instance replaces direct initialization

/**
 * Sends student answers to Gemini 2.5 Flash for dynamic rubric evaluation
 * @param {string} question - The target question assigned to the student
 * @param {string|Object} responseInput - The student's typed text string OR the Multer file buffer object for audio
 * @param {Object} criteriaMap - The dynamic criteria points framework (e.g., { Content: 10, Grammar: 5 })
 * @param {string} aiNotes - Custom hints or instruction parameters provided by the teacher
 * @returns {Promise<Object>} The structured evaluation payload matching our JSON contract
 */
export const evaluateWithGemini = async (
  question,
  responseInput,
  criteriaMap,
  aiNotes = "",
) => {
  try {
    const criteriaString = JSON.stringify(criteriaMap);
    let aiContentsPayload = [];

    const systemInstruction = `
      You are an expert academic evaluator and strict oral examiner. 
      Your task is to grade a student's submission based strictly on the provided question and the instructor's dynamic evaluation criteria weights.
      
      Review the maximum allowed marks for each item in the criteria map. Score each item individually, then compute the absolute mathematical total sum.
      Provide highly specific, constructive diagnostic feedback explaining the scoring and identifying areas for structural optimization.
    `;

    if (
      responseInput &&
      typeof responseInput === "object" &&
      responseInput.buffer
    ) {
      const audioPart = {
        inlineData: {
          data: responseInput.buffer.toString("base64"),
          mimeType: responseInput.mimetype,
        },
      };
      aiContentsPayload.push(audioPart);

      aiContentsPayload.push(`
        Analyze the attached audio waveform file directly to evaluate acoustics, pacing, and spoken mechanics alongside textual translation.
        Instructor Evaluation Criteria Map (Max points weight allocation): ${criteriaString}
        ${aiNotes ? `Special Instructor Grading Notes/Focus Points: "${aiNotes}"` : ""}
      `);
    } else {
      aiContentsPayload.push(`
        Student Typed Response Text: "${responseInput}"
        Instructor Evaluation Criteria Map (Max points weight allocation): ${criteriaString}
        ${aiNotes ? `Special Instructor Grading Notes/Focus Points: "${aiNotes}"` : ""}
      `);
    }

    const userPrompt = `Target Question: "${question}"`;
    aiContentsPayload.push(userPrompt);

    // ⚡ DYNAMIC SCHEMA INJECTION: Map criteria fields to strict JSON properties
    const dynamicScoreProperties = {};
    const scoreRequiredFields = [];

    if (criteriaMap && typeof criteriaMap === "object") {
      Object.keys(criteriaMap).forEach((key) => {
        dynamicScoreProperties[key] = {
          type: Type.NUMBER,
          description: `Score awarded for ${key}. Max points possible: ${criteriaMap[key]}`,
        };
        scoreRequiredFields.push(key);
      });
    }

    // Execute the generation request utilizing structural JSON enforcement
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: aiContentsPayload,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scores: {
              type: Type.OBJECT,
              properties: dynamicScoreProperties, // ◄── FIXED: Tells Gemini exactly which rubric keys to produce
              required: scoreRequiredFields, // ◄── FIXED: Enforces all rubric fields are evaluated
              description:
                "A key-value map assigning individual numerical scores to each defined rubric item.",
            },
            totalScoreGivenByAI: {
              type: Type.NUMBER,
              description:
                "The absolute mathematical sum total of all marks awarded in the scores object.",
            },
            feedback: {
              type: Type.STRING,
              description:
                "Targeted coaching, explaining where marks were deducted and offering remediation tips.",
            },
            transcript: {
              type: Type.STRING,
              description:
                "Clean transcription layout text of the spoken file if audio was evaluated, else mirror back textual input strings.",
            },
          },
          required: ["scores", "totalScoreGivenByAI", "feedback", "transcript"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("❌ Gemini Service Runtime Exception:", error);
    throw new Error(`AI Evaluation processing failed: ${error.message}`);
  }
};

/**
 * Ingests a teacher reference document and generates a structured pool of targeted questions
 * @param {Object} documentFile - The Multer memory buffer object containing the reference material text
 * @param {number} count - Total number of unique questions to generate
 * @param {string} dynamicFocus - Optional notes from the teacher on what topics to focus on
 * @returns {Promise<Array<string>>} Array of cleanly generated question strings
 */
export const generateQuestionsFromMaterial = async (
  documentFile,
  count = 5,
  dynamicFocus = "",
) => {
  try {
    // Extract the raw string from the memory buffer
    const materialText = documentFile.buffer.toString("utf-8");

    const systemInstruction = `
      You are an expert academic professor. Your job is to thoroughly analyze the attached reference material document text
      and generate a diverse list of highly targeted test questions. 
      The questions must be clean, precise, academic, and completely answerable using only the provided context material.
    `;

    const userPrompt = `
      Analyze the reference text below:
      --- START OF MATERIAL ---
      ${materialText}
      --- END OF MATERIAL ---

      Generate exactly ${count} distinct questions based on this material.
      ${dynamicFocus ? `Special Focus Instructions from the Teacher: "${dynamicFocus}"` : ""}

      CRITICAL RETURN PROTOCOL:
      You MUST respond exclusively using a valid parsed JSON array of strings containing only the questions. 
      Do not include numbers, bullet marks, or wrapper markdown text. Follow this exact structural shape:
      [
        "Question number one query text here?",
        "Question number two query text here?"
      ]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("❌ Material Question Generation Failure:", error);
    throw new Error(
      `Failed to extract questions from document: ${error.message}`,
    );
  }
};

export const evaluateConversationTurn = async ({
  assignmentTitle,
  aiNotes,
  criteriaMap,
  history,
  audioFile,
}) => {
  try {
    // Format dialogue logs into readable text for Gemini's prompt context
    const formattedHistory = history
      .map(
        (turn) =>
          `${turn.role === "interviewer" ? "Interviewer/AI" : "Student"}: "${turn.text}"`,
      )
      .join("\n");

    const systemInstruction = `
      You are an advanced, adaptive dynamic oral examiner and real-time conversation simulator. 
      The current exercise topic context is: "${assignmentTitle}".
      Instructor Custom Instructions & Notes: "${aiNotes}".
      
      Your role is to analyze the student's incoming voice recording, transcribe it accurately, and dynamically generate the next logical conversational question or follow-up response.
      
      CRITICAL INSTRUCTOR DIRECTIVES & LIFECYCLE MANAGEMENT RULES:
      - Read and strictly follow the instructor's rules, topic constraints, and custom instructions provided here: "${aiNotes}".
      - Dynamically determine how many questions to ask, what topics to cover, and when the assessment has reached its logical conclusion based entirely on those Instructor Notes and the flow of the conversation history.
      
      CONVERSATION TERMINATION PROTOCOL:
      - When you determine that the conversation goals outlined by the instructor have been fully met, or the conversation should conclude, you MUST set the 'nextQuestion' field text value strictly to "CONVERSATION_COMPLETE".
      - EXCLUSIVELY when setting 'nextQuestion' to "CONVERSATION_COMPLETE", you MUST grade the entire accumulated conversational dialogue history against this rubric criteria: ${JSON.stringify(criteriaMap)}. Populate 'finalScores', 'totalScoreGivenByAI', and 'finalFeedback'.
      - If the conversation is ongoing and you are asking a follow-up question, leave the scoring fields empty, null, or zeroed out.
    `;

    const aiContentsPayload = [
      {
        inlineData: {
          data: audioFile.buffer.toString("base64"),
          mimeType: audioFile.mimetype,
        },
      },
      `
        --- AUDIO DIALOGUE TIMELINE AND HISTORY LOG ---
        ${formattedHistory || "No previous interactions. This is the student's initial introductory speech response."}
        --- END OF HISTORICAL LOG ---
        
        Analyze the latest audio file buffer payload attached above. Transcribe it, insert it into the chronological stream context, and compute your next response output.
      `,
    ];

    // Build dynamic inner fields for criteria maps safely
    const dynamicScoreProperties = {};
    const scoreRequiredFields = [];
    if (criteriaMap && typeof criteriaMap === "object") {
      Object.keys(criteriaMap).forEach((key) => {
        dynamicScoreProperties[key] = {
          type: Type.NUMBER,
          description: `Score awarded for ${key}. Max weight capacity: ${criteriaMap[key]}`,
        };
        scoreRequiredFields.push(key);
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: aiContentsPayload,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: {
              type: Type.STRING,
              description:
                "Verbatim text transcription layout of what the student said in the audio file.",
            },
            nextQuestion: {
              type: Type.STRING,
              description:
                "The next targeted dynamic question line to speak back. Set strictly to 'CONVERSATION_COMPLETE' when ending the assessment loop.",
            },
            finalScores: {
              type: Type.OBJECT,
              properties: dynamicScoreProperties,
              required: scoreRequiredFields,
              description:
                "Rubric mapping score breakdown object. Populate ONLY when conversation finishes.",
            },
            totalScoreGivenByAI: {
              type: Type.NUMBER,
              description:
                "Mathematical sum total of all scored rubric components. Populate ONLY when conversation finishes.",
            },
            finalFeedback: {
              type: Type.STRING,
              description:
                "Comprehensive critique summary detailing actionable feedback. Populate ONLY when conversation finishes.",
            },
          },
          required: ["transcript", "nextQuestion"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("❌ Gemini Dialogue Engine Runtime Exception:", error);
    throw error;
  }
};
