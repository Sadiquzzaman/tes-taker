export const sumSubjectMarks = (subject: StudentExamSubject): number =>
  subject.questions.reduce((marks, question) => {
    if ("childQuestions" in question) {
      return marks + question.childQuestions.reduce((childMarks, child) => childMarks + (child.points ?? 0), 0);
    }
    return marks + (question.points ?? 0);
  }, 0);

export const sumExamMarks = (subjects: StudentExamSubject[]): number =>
  subjects.reduce((total, subject) => total + sumSubjectMarks(subject), 0);
