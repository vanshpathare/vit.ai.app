import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import sharp from "sharp";
dotenv.config();

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Universal R2 Uploader
 * @param {Buffer} fileBuffer - The file buffer
 * @param {String} fileName - Original file name
 * @param {String} folderPath - e.g. "submissions/assignmentId/studentId" or "assignments/assignmentId"
 * @param {String} mimeType - File mime type
 */
export const uploadToR2 = async (
  fileBuffer,
  fileName,
  folderPath,
  mimeType,
) => {
  let processedBuffer = fileBuffer;

  // 🟢 2. COMPRESS IMAGES TO SAVE R2 STORAGE SPACE
  // Shrinks large 5MB-15MB phone photos to optimized widths (~1600px) and 80% quality
  // without losing text legibility for AI OCR or perceptual hashing.
  if (mimeType && mimeType.startsWith("image/")) {
    try {
      processedBuffer = await sharp(fileBuffer)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (err) {
      console.warn(
        "⚠️ Image compression skipped, uploading original buffer:",
        err.message,
      );
      processedBuffer = fileBuffer;
    }
  }

  // 📂 Construct the structured path dynamically
  const fileKey = `${folderPath}/${Date.now()}-${fileName}`;

  const uploadParams = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileKey,
    Body: processedBuffer,
    ContentType: mimeType,
  };

  try {
    await s3.send(new PutObjectCommand(uploadParams));

    // Return public R2 URL
    return `${process.env.R2_PUBLIC_DOMAIN}/${fileKey}`;
  } catch (error) {
    console.error("❌ Cloudflare R2 Upload Error:", error);
    throw new Error("Failed to upload file to Cloudflare R2 storage.");
  }
};

/**
 * Delete a file from Cloudflare R2 when an assignment or submission is removed
 */
export const deleteFromR2 = async (fileUrl) => {
  try {
    const urlObj = new URL(fileUrl);
    const fileKey = urlObj.pathname.substring(1); // Remove leading slash

    const deleteParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
    };

    await s3.send(new DeleteObjectCommand(deleteParams));
    return true;
  } catch (error) {
    console.error("❌ Cloudflare R2 Delete Error:", error);
    return false;
  }
};
