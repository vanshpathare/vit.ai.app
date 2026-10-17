import fs from "fs";
import { createWorker } from "tesseract.js";

async function testTesseract() {
  const imagePath = "./test-sample.jpg";
  if (!fs.existsSync(imagePath)) {
    console.error(
      "❌ Error: Please place 'test-sample.jpg' inside your backend folder first!",
    );
    return;
  }

  try {
    console.log("⏳ Initializing local Tesseract OCR worker...");
    const worker = await createWorker("eng");

    console.log("⏳ Analyzing image text locally...");
    const startTime = Date.now();

    // Perform OCR recognition on the image
    const {
      data: { text },
    } = await worker.recognize(imagePath);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    await worker.terminate();

    console.log(
      `\n✅ [Tesseract Result Successfully Received in ${duration}s]:\n`,
    );
    console.log(text);
  } catch (error) {
    console.error("❌ Tesseract Error:", error.message);
  }
}

testTesseract();
