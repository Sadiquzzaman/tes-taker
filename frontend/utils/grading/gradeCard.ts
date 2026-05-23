export const gradeCardStatusColors: Record<GradeCardStatus, string> = {
  Graded: "rgba(0,233,33,0.15)",
  GradedTests: "rgba(73,115,79,0.15)",
  NeedsGrading: "#ED860025",
  Published: "rgba(73,115,79,0.15)",
};

export const gradeCardStatusTextColors: Record<GradeCardStatus, string> = {
  Graded: "#49734F",
  GradedTests: "#49734F",
  NeedsGrading: "#ED8600",
  Published: "#49734F",
};

export const getGradeCardButtonText = (status: GradeCardStatus) => {
  if (status === "Graded") return "Test Results";
  if (status === "NeedsGrading") return "Continue Grading";
  if (status === "GradedTests") return "Graded Test";
  return "Continue marking";
};
