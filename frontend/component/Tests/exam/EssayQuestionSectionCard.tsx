import NotmalTextFeild from "@/Ui/NotmalTextFeild";

const EssayQuestionSectionCard = ({
  section,
  answerSheet,
  setAnswerSheet,
  disabled,
}: {
  section: StudentExamQuestionSection;
  answerSheet: Record<string, string>;
  setAnswerSheet: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  disabled: boolean;
}) => {
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswerSheet((currentAnswerSheet) => ({
      ...currentAnswerSheet,
      [questionId]: value,
    }));
  };

  return (
    <section className="flex w-full flex-col items-start gap-4 self-stretch rounded-[8px] bg-[rgba(239,240,243,0.75)] p-4">
      <div className="flex flex-col items-start gap-1">
        <p className="text-[24px] font-[600] leading-[28px] text-[#232A25]">{section.headerText}</p>
        <p className="text-[14px] font-[400] leading-[16px] text-[#747775]">{section.questions.length} Questions</p>
      </div>

      <div className="flex w-full flex-col gap-4">
        {section.questions.map((question, index) => (
          <article key={question.id} className="flex w-full flex-col gap-3 rounded-[6px] bg-white p-4">
            {question.instruction ? (
              <div className="flex items-start gap-2 rounded-[6px] bg-white">
                <span className="mt-[2px] text-[16px] leading-[125%] text-[#49734f]">•</span>
                <p className="text-[14px] font-[400] text-[#49734f]">{question.instruction}</p>
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-2">
                <span className="text-[16px] font-[500] leading-[125%] text-[#0F1A12]">{index + 1}.</span>
                <p className="text-[16px] font-[500] leading-[125%] text-[#0F1A12]">{question.text}</p>
              </div>
              <span className="shrink-0 text-[14px] font-[400] leading-[16px] text-[#747775]">
                Points: {question.points}
              </span>
            </div>

            <NotmalTextFeild
              value={answerSheet[question.id] ?? ""}
              onChange={(event) => handleAnswerChange(question.id, event.target.value)}
              placeholder="Write your answer"
              rows={4}
              maxRows={4}
              disabled={disabled}
              parentClassName="border-[#E5E7EB] bg-white px-3 py-3"
              inputClassName="text-[16px] font-[400] leading-[18px] text-[#232A25] placeholder:text-[#747775]"
            />

            <p className="text-[14px] font-[400] leading-[125%] text-[#747775]">
              Word count {answerSheet[question.id]?.trim() ? answerSheet[question.id].trim().split(/\s+/).length : 0}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default EssayQuestionSectionCard;
