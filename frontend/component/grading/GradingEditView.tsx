import { template } from "@/utils/grading/gradingTemplate";
import EssayGradeTemplate from "./EssayGradeTemplate";
import ObjectiveGradeTemplate from "./ObjectiveGradeTemplate";

interface GradingEditViewProps {
  handleExplanationChange: (questionId: string, explanation: string) => void;
  questionInputData: Record<string, { explanation: string }>;
}

const GradingEditView = ({ handleExplanationChange, questionInputData }: GradingEditViewProps) => {
  const isModelTest = template.formState.examType === "model";

  return (
    <div className="mt-4 flex flex-col gap-4">
      {template.subjects.flatMap((subject) =>
        subject.questionSections.map((section) => {
          const gradedCount = section.questions.filter((question) => question.showValidation).length;

          if (section.questions.length === 0) {
            return null;
          }

          const questionList =
            section.type === "essay"
              ? section.questions.map((question, questionIndex) => (
                  <EssayGradeTemplate
                    key={question.id}
                    number={questionIndex + 1}
                    question={question.text}
                    answer="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                    score={4}
                    maxMarks={question.points}
                    explanation={questionInputData[question.id]?.explanation || ""}
                    onExplanationChange={(value) => handleExplanationChange(question.id, value)}
                  />
                ))
              : section.questions.map((question, questionIndex) => (
                  <ObjectiveGradeTemplate
                    key={question.id}
                    number={questionIndex + 1}
                    question={question.text}
                    options={question.options}
                    answer={question.studentSelectedOptionId || ""}
                    correctOptionId={question.correctOptionId}
                    score={4}
                    maxMarks={question.points}
                    explanation={questionInputData[question.id]?.explanation || ""}
                    onExplanationChange={(value) => handleExplanationChange(question.id, value)}
                  />
                ));

          return (
            <div key={section.id} className="flex flex-col gap-4">
              <p className="text-[24px] font-[600] leading-[100%] tracking-[-0.02em] text-[#747775]">
                {section.headerText} {isModelTest ? `(${subject.name})` : ""}
              </p>
              <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#747775]">
                {gradedCount} of {section.questions.length} questions {section.type === "objective" ? "auto " : ""}
                graded
              </p>

              {questionList}
            </div>
          );
        }),
      )}
    </div>
  );
};

export default GradingEditView;
