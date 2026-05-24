import EditSquareIconSVG from "../svg/EditSquareIconSVG";
import EssayGradeTemplate from "./EssayGradeTemplate";
import ObjectiveGradeTemplate from "./ObjectiveGradeTemplate";

interface GradingResultViewProps {
  allQuestion: { name: string; questionList: GradingQuestionWithType[] }[];
  setOpenModal: (open: GradingModalView) => void;
}

const GradingResultView = ({ allQuestion, setOpenModal }: GradingResultViewProps) => {
  const questionGroups = allQuestion.map((subject) => (
    <div key={subject.name} className="flex flex-col gap-4">
      {subject.questionList.map((question, questionIndex) =>
        question.type === "essay" ? (
          <EssayGradeTemplate
            key={question.id}
            number={questionIndex + 1}
            question={question.text}
            answer="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            score={4}
            maxMarks={question.points}
          />
        ) : (
          <ObjectiveGradeTemplate
            key={question.id}
            number={questionIndex + 1}
            question={question.text}
            options={question.options}
            answer={question.studentSelectedOptionId || ""}
            correctOptionId={question.correctOptionId}
            score={4}
            maxMarks={question.points}
          />
        ),
      )}
    </div>
  ));

  return (
    <>
      <div className="flex items-center justify-between py-4">
        <p className="text-[20px] font-[500] leading-[20px] tracking-[-0.02em] text-[#747775]">Answer sheet</p>
        <div className="flex items-center gap-4">
          <p className="text-[20px] font-[500] leading-[20px] tracking-[-0.02em] text-[#49734F]">Score: 24</p>
          <div
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] bg-[#EFF0F3]"
            onClick={() => setOpenModal("edit")}
          >
            <div className="text-[#747775]">
              <EditSquareIconSVG width={14} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">{questionGroups}</div>
    </>
  );
};

export default GradingResultView;
