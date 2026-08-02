import Resource from "../models/Resource.js";
import { uploadToSupabase } from "../services/storageService.js";
import { deleteFromSupabase } from "../services/storageService.js";

// GET all resources for the Classroom Files Tab
export const getClassroomResources = async (req, res) => {
  try {
    const { classId } = req.params;

    // Fetch all resources for this classroom sorted newest first
    const resources = await Resource.find({ classroomId: classId })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ data: resources });
  } catch (error) {
    console.error("Error fetching classroom resources:", error);
    res.status(500).json({ message: "Failed to load classroom files" });
  }
};

// POST new resource (Handles both Supabase File Upload & Direct Drive/YouTube Link)
export const createResource = async (req, res) => {
  try {
    const { classId } = req.params;
    const { title, resourceType, url, fileType } = req.body;

    const uploadedBy = req.user?._id || req.user?.id;

    if (!uploadedBy) {
      return res.status(401).json({ message: "User authentication required." });
    }

    let finalUrl = url;
    let finalFileType = fileType || "file";

    // 1. If a direct file is uploaded, push to Supabase Storage
    if (req.file) {
      const uploadResult = await uploadToSupabase(req.file, title);
      finalUrl = uploadResult?.fileUrl || uploadResult?.publicUrl;

      // Auto-detect extension if fileType was not provided by frontend
      if (!fileType && req.file.originalname) {
        finalFileType =
          req.file.originalname.split(".").pop()?.toLowerCase() || "file";
      }
    }

    // 2. Safeguard: Prevent creating an empty resource without a valid destination URL
    if (!finalUrl) {
      return res.status(400).json({
        message:
          "Resource creation failed. A valid file upload or URL link is required.",
      });
    }

    // 3. Create document in MongoDB
    const newResource = new Resource({
      title: title || req.file?.originalname || "Untitled Resource",
      resourceType: resourceType || (req.file ? "file" : "link"),
      url: finalUrl,
      fileType: finalFileType,
      classroomId: classId,
      uploadedBy,
    });

    await newResource.save();

    // 4. Populate uploader details so UI updates seamlessly
    await newResource.populate("uploadedBy", "name email");

    res.status(201).json({
      message: "Resource added successfully",
      data: newResource,
    });
  } catch (error) {
    console.error("Error creating resource:", error);
    res.status(500).json({
      message: "Failed to add resource",
      error: error.message,
    });
  }
};

// DELETE resource
export const deleteResource = async (req, res) => {
  try {
    const { resourceId } = req.params;

    // 1. Find the resource record first to get its URL and type
    const resource = await Resource.findById(resourceId);

    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    // 2. If it's an uploaded file (Supabase), delete it from storage
    if (resource.resourceType === "file" && resource.url) {
      await deleteFromSupabase(resource.url);
    }

    // 3. Delete the record from MongoDB
    await Resource.findByIdAndDelete(resourceId);

    return res.status(200).json({ message: "Resource deleted successfully" });
  } catch (error) {
    console.error("Delete resource error:", error);
    return res.status(500).json({ message: "Failed to delete resource" });
  }
};
