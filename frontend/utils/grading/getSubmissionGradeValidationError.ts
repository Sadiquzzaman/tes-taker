/** Why a mark is not allowed, as a key under grading.answer ("belowZero" | "aboveMax"), or "" when it is fine. */
const getSubmissionGradeValidationError = (marksObtained: number, maxPoints: number): "" | "belowZero" | "aboveMax" => {
  if (marksObtained < 0) {
    return "belowZero";
  }
  if (marksObtained > maxPoints) {
    return "aboveMax";
  }
  return "";
};

export default getSubmissionGradeValidationError;
