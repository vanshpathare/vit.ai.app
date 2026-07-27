// utils/rollNumberSort.js
//
// Roll number format examples: 24102B0011, 24102A0002, 25102B2001
//   - First 2 digits  = admission year        (rule a: lower year sorts first)
//   - Middle digits   = program code (ignored for sorting — not part of the spec)
//   - 1 letter        = division/batch A/B/C  (rule b: A < B < C)
//   - Last 4 digits   = serial number          (rule c: ascending)
//
// Applied in strict priority: rule a, then rule b, then rule c — matching:
//   24102A0006 < 24102A0014 < 24102B0003 < 25102B2011

const ROLL_PATTERN = /^(\d{2}).*?([A-Za-z])(\d{4})$/;

/**
 * Parses a roll number string into its comparable pieces.
 * Unparseable or missing roll numbers sort to the very end (rather than crashing
 * the sort or throwing), so legacy accounts without one don't break the page.
 */
export function parseRollNumber(rollNumber) {
  const match = ROLL_PATTERN.exec((rollNumber || "").trim());
  if (!match) {
    return { year: 99, letter: "ZZ", last4: 9999, raw: rollNumber || "" };
  }
  return {
    year: parseInt(match[1], 10),
    letter: match[2].toUpperCase(),
    last4: parseInt(match[3], 10),
    raw: rollNumber,
  };
}

/**
 * Comparator for Array.prototype.sort — pass two roll number strings (or objects
 * with a `.rollNumber` field via the `key` helper below).
 */
export function compareRollNumbers(a, b) {
  const pa = parseRollNumber(a);
  const pb = parseRollNumber(b);

  if (pa.year !== pb.year) return pa.year - pb.year; // rule a
  if (pa.letter !== pb.letter) return pa.letter.localeCompare(pb.letter); // rule b
  if (pa.last4 !== pb.last4) return pa.last4 - pb.last4; // rule c
  return pa.raw.localeCompare(pb.raw); // final tiebreaker for identical roll numbers
}

/**
 * Convenience sorter for arrays of student objects (e.g. Mongoose docs or plain
 * objects) that have a `rollNumber` field. Does not mutate the input array.
 */
export function sortStudentsByRollNumber(students) {
  return [...students].sort((a, b) =>
    compareRollNumbers(a?.rollNumber, b?.rollNumber),
  );
}
