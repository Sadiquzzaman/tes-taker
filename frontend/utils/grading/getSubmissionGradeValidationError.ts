const getSubmissionGradeValidationError = (marksObtained: number, maxPoints: number) => {
  if (marksObtained < 0) {
    return "Score can not be less then 0";
  }

  if (marksObtained > maxPoints) {
    return "Score can not be more then max points";
  }

  return "";
};

export default getSubmissionGradeValidationError;
