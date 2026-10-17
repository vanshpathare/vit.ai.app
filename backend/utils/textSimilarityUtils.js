/**
 * Calculates text similarity ratio between two strings using word token intersection (Jaccard-like similarity).
 * Filters out common stop words and short words to focus on substantive content.
 */
export function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  const cleanAndTokenize = (str) => {
    return new Set(
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3), // Ignore very short words / stop words
    );
  };

  const words1 = cleanAndTokenize(text1);
  const words2 = cleanAndTokenize(text2);

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  const union = new Set([...words1, [...words2]]).size;
  return intersection / union; // Returns a decimal ratio (e.g., 0.88 for 88%)
}
