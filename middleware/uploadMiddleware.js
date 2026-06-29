import multer from "multer";

// 🧠 MEMORY SHIELD CONFIGURATION
// Allocates file binary chunks straight into volatile RAM memory buffers.
// This guarantees that zero physical file footprints ever touch or clog your laptop's hard drive!
const storage = multer.memoryStorage();

/**
 * Validates incoming multipart file data streams before allowing access to controllers
 */
const fileFilter = (req, file, cb) => {
  // 1. Allow voice recordings for student speech-modality assignments
  const isAudio = file.mimetype.startsWith("audio/");

  // 2. Allow raw text materials for dynamic teacher question pool generation
  const isTextDocument =
    file.mimetype === "text/plain" ||
    file.mimetype === "application/octet-stream" ||
    file.originalname.endsWith(".txt") ||
    file.originalname.endsWith(".md");

  if (isAudio || isTextDocument) {
    cb(null, true); // File meets structural safety constraints; pass it forward
  } else {
    cb(
      new Error(
        "Security Block: Unsupported file format. Only valid audio files or plain text documents are permitted!",
      ),
      false,
    );
  }
};

// 🎛️ EXPORT UPLOAD CONTEXT MIDDLEWARE INTERCEPTOR
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // Caps multi-part buffer sizes at 15MB maximum to optimize throughput safety
  },
});
