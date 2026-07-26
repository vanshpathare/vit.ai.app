export const getInitials = (fullName, fallback = "US") => {
  if (!fullName || !fullName.trim()) return fallback;

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  const first = parts[0][0] || "";
  const last = parts[parts.length - 1][0] || "";
  return (first + last).toUpperCase();
};

export default getInitials;
