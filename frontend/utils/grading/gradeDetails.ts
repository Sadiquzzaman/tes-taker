export const classTabList = [
  { name: "Student", value: "student" },
  { name: "Tests", value: "tests" },
] as const;

export const statusColors: Record<GradingStatus, string> = {
  Graded: "rgba(0,233,33,0.15)",
  Pending: "#ED860025",
};

export const statusTextColors: Record<GradingStatus, string> = {
  Graded: "#49734F",
  Pending: "#ED8600",
};

export const statusButtonText: Record<GradingStatus, string> = {
  Graded: "Student Result",
  Pending: "Start Grading",
};

export const studentList: GradingStudent[] = [
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Pending", score: null },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Graded", score: "18/20" },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Pending", score: null },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Graded", score: "18/20" },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Pending", score: null },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Graded", score: "18/20" },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Pending", score: null },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Graded", score: "18/20" },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Pending", score: null },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Graded", score: "18/20" },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Pending", score: null },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Graded", score: "18/20" },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Pending", score: null },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Graded", score: "18/20" },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Pending", score: null },
  { name: "Anonymous", email: "Anonymous", submittedAt: "Mar 05, 2025 · 10:30 AM", status: "Graded", score: "18/20" },
];
