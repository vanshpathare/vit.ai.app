// utils/subjectIcons.js
//
// 📁 WHERE TO PUT YOUR IMAGE FILES:
//   frontend/public/subject-icons/<filename>
//
// Anything in Vite's `public/` folder is served as-is at the site root, so a file at
// `frontend/public/subject-icons/coding.png` is reachable at the URL `/subject-icons/coding.png`
// — which is exactly the `image` path each entry below points at. If your actual image
// files use different names, just edit the `image` value here to match — you don't
// need to rename your files to fit this list.
//
// This is also the single place to add/remove subjects from the picker teachers see
// when creating a classroom — add a new entry here and it shows up automatically.

export const SUBJECT_ICONS = [
  {
    key: "circuits",
    label: "Circuits",
    image: "/subject-icons/circuits.jpeg",
    gradient: "from-indigo-500 via-purple-500 to-purple-700",
  },
  {
    key: "classroom",
    label: "Classroom",
    image: "/subject-icons/classroom.jpeg",
    gradient: "from-blue-500 via-sky-500 to-cyan-600",
  },
  {
    key: "coding",
    label: "Coding",
    image: "/subject-icons/coding.jpeg",
    gradient: "from-emerald-500 via-teal-500 to-teal-700",
  },
  {
    key: "communication",
    label: "Communication",
    image: "/subject-icons/communication.jpeg",
    gradient: "from-amber-500 via-orange-500 to-orange-700",
  },
  {
    key: "computer",
    label: "Computer",
    image: "/subject-icons/computer.jpeg",
    gradient: "from-pink-500 via-rose-500 to-rose-700",
  },
  {
    key: "electronics",
    label: "Electronics",
    image: "/subject-icons/electronics.jpeg",
    gradient: "from-fuchsia-500 via-purple-500 to-indigo-600",
  },
  {
    key: "graphics",
    label: "Graphics",
    image: "/subject-icons/graphics.jpeg",
    gradient: "from-yellow-600 via-amber-600 to-orange-700",
  },
  {
    key: "general",
    label: "General",
    image: "/subject-icons/general.jpeg",
    gradient: "from-slate-500 via-slate-600 to-slate-700",
  },
  {
    key: "nature",
    label: "Nature",
    image: "/subject-icons/nature.jpeg",
    gradient: "from-green-500 via-emerald-500 to-teal-600",
  },
  {
    key: "physics",
    label: "Physics",
    image: "/subject-icons/physics.jpeg",
    gradient: "from-pink-500 via-rose-500 to-rose-700",
  },
  {
    key: "sky",
    label: "Sky",
    image: "/subject-icons/sky.jpeg",
    gradient: "from-violet-500 via-fuchsia-500 to-pink-600",
  },
  {
    key: "random",
    label: "Random",
    image: "/subject-icons/random.jpeg",
    gradient: "from-violet-500 via-fuchsia-500 to-pink-600",
  },
];

export const getSubjectIcon = (key) =>
  SUBJECT_ICONS.find((s) => s.key === key) ||
  SUBJECT_ICONS[SUBJECT_ICONS.length - 1];
