export const gradeCardStatusColors: Record<GradingStatus, string> = {
  GRADED: "rgba(73,115,79,0.15)",
  NEEDS_GRADING: "#ED860025",
  PUBLISHED: "rgba(73,115,79,0.15)",
};

export const gradeCardStatusTextColors: Record<GradingStatus, string> = {
  GRADED: "#49734F",
  PUBLISHED: "#49734F",
  NEEDS_GRADING: "#ED8600"
};

export const getGradeCardStatusLabel = (gradingStatus: GradingStatus) => {
  if (gradingStatus === "NEEDS_GRADING") return "Needs Grading"
  if (gradingStatus === "PUBLISHED") return "Published"
  return "Graded";
};
