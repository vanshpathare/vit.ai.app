import { uploadToSupabase } from "../services/storageService.js";

export const handleFileUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Capture custom name sent from frontend form data
    const customName = req.body.customName;

    const fileData = await uploadToSupabase(req.file, customName);

    return res.status(200).json({
      message: "File uploaded successfully",
      data: fileData, // Returns { fileUrl, fileName, filePath }
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res
      .status(500)
      .json({ message: error.message || "File upload failed" });
  }
};
