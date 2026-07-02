const buildSubmissionGrades = (data: GradingModalData): GradingSubmissionGrade[] => {
  return data.items.reduce<GradingSubmissionGrade[]>((grades, item) => {
    if (item.kind !== "question" || !item.question.isEditable) {
      return grades;
    }

    grades.push({
      question_id: item.question.id,
      marks_obtained: item.question.marksObtained ?? 0,
      explanation: "",
    });

    return grades;
  }, []);
};

export default buildSubmissionGrades;
