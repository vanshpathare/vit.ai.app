export function toCriteriaMap(assignment) {
  const c = assignment.evaluationCriteria;
  const map =
    c instanceof Map || Array.isArray(c)
      ? Object.fromEntries(c)
      : c && typeof c === "object"
        ? { ...c }
        : {};
  return Object.keys(map).length
    ? map
    : { "Overall Performance": assignment.totalMarks || 20 };
}
