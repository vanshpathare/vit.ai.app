import { supabase } from "../config/supabase.js";

export const uploadToSupabase = async (file, customName) => {
  // Extract real extension (.pdf, .docx, etc.)
  const fileExtension = file.originalname.split(".").pop();

  // Clean unique path for Supabase storage key
  const uniqueKey = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
  const filePath = `resources/${uniqueKey}`;

  // Upload memory buffer to Supabase Bucket
  const { data, error } = await supabase.storage
    .from("assignbuddy-files")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) throw new Error(`Supabase Upload Error: ${error.message}`);

  // Get the public URL for retrieval/download
  const { data: publicUrlData } = supabase.storage
    .from("assignbuddy-files")
    .getPublicUrl(filePath);

  return {
    fileUrl: publicUrlData.publicUrl,
    // Use the custom name if supplied, otherwise fallback to original file name
    fileName: customName?.trim() || file.originalname,
    filePath,
  };
};

const extractFilePathFromUrl = (publicUrl) => {
  if (!publicUrl || !publicUrl.includes("/assignbuddy-files/")) return null;
  return publicUrl.split("/assignbuddy-files/")[1];
};

/**
 * Deletes a file from Supabase Storage by its public URL
 */
export const deleteFromSupabase = async (publicUrl) => {
  try {
    const filePath = extractFilePathFromUrl(publicUrl);

    // If it's a Google Drive/YouTube link, skip Supabase deletion
    if (!filePath) return;

    const { data, error } = await supabase.storage
      .from("assignbuddy-files")
      .remove([filePath]);

    if (error) {
      console.error("Failed to delete file from Supabase:", error.message);
    } else {
      console.log(`Successfully deleted ${filePath} from Supabase Storage.`);
    }
  } catch (err) {
    console.error("Error during Supabase file cleanup:", err.message);
  }
};
