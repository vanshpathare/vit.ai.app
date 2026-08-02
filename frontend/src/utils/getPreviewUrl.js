export const getPreviewUrl = (url) => {
  if (!url) return "#";

  // Checks extension OR if the file path contains office document types
  const isOfficeDoc =
    /\.(docx?|xlsx?|pptx?)(\?.*)?$/i.test(url) ||
    /(\.docx?|\.xlsx?|\.pptx?)/i.test(url);

  if (isOfficeDoc) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }

  return url;
};
