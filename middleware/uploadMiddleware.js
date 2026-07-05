import multer from "multer";

// 🧠 MEMORY SHIELD CONFIGURATION
// Allocates file binary chunks straight into volatile RAM memory buffers.
// This guarantees that zero physical file footprints ever touch or clog your laptop's hard drive!
const storage = multer.memoryStorage();

/**
 * Validates incoming multipart file data streams before allowing access to controllers
 */
const fileFilter = (req, file, cb) => {
  const isAudio = file.mimetype.startsWith("audio/");

  // 📝 Extended Document Support Matrix
  const isSupportedDocument =
    file.mimetype === "text/plain" ||
    file.mimetype === "application/pdf" || // PDFs
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || //.docx
    file.originalname.endsWith(".txt") ||
    file.originalname.endsWith(".md") ||
    file.originalname.endsWith(".pdf") ||
    file.originalname.endsWith(".docx");

  if (isAudio || isSupportedDocument) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Security Block: Unsupported file format. Only audio files, PDFs, Word documents (.docx), or plain text are permitted!",
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
    fileSize: 100 * 1024 * 1024, // Caps multi-part buffer sizes at 100MB maximum to optimize throughput safety
  },
});
