import express from "express";
import { upload } from "../middleware/uploadMiddleware.js";
import { handleFileUpload } from "../controllers/storageController.js";

const router = express.Router();

// POST /api/storage/upload-resource
router.post("/upload-resource", upload.single("file"), handleFileUpload);

export default router;
