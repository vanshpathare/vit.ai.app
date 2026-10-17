import imghash from "imghash";

/**
 * Generates a perceptual hash string for an image buffer
 */
export const generateImagePHash = async (buffer) => {
  try {
    // Generates a hex perceptual hash string using the default import object
    return await imghash.hash(buffer);
  } catch (err) {
    console.error("❌ pHash generation error:", err.message);
    return null;
  }
};

/**
 * Compares two perceptual hashes using Hamming distance.
 * Returns true if the distance is below the threshold (meaning the images are visually nearly identical).
 */
export const comparePHashes = (hash1, hash2, threshold = 5) => {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return false;

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance <= threshold;
};
