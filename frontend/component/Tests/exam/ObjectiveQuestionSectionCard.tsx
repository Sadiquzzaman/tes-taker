const ObjectiveQuestionSectionCard = ({
  section,
  negativeMarkValue,
  isNegativeMarkingEnabled,
  answerSheet,
  setAnswerSheet,
  disabled,
}: {
  section: StudentExamQuestionSection;
  negativeMarkValue: number;
  isNegativeMarkingEnabled: boolean;
  answerSheet: Record<string, string>;
  setAnswerSheet: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  disabled: boolean;
}) => {
  const getNegativeMarkText = (points: number) => {
    if (!isNegativeMarkingEnabled) {
      return null;
    }

    const negativeMark = (points * negativeMarkValue) / 100;

    return Number.isInteger(negativeMark) ? negativeMark.toString() : negativeMark.toFixed(2);
  };

  return (
    <section className="flex w-full flex-col items-start gap-4 self-stretch rounded-[8px] bg-[rgba(239,240,243,0.75)] p-4">
      <div className="flex flex-col items-start gap-1">
        {section.instruction ? (
          <div className="flex items-start gap-2 rounded-[6px]">
            <p className="text-[14px] font-[400] text-[#49734f]">Instruction: {section.instruction}</p>
          </div>
        ) : null}
        <p className="text-[24px] font-[600] leading-[28px] text-[#232A25]">{section.headerText}</p>
        <p className="text-[14px] font-[400] leading-[16px] text-[#747775]">{section.questions.length} Questions</p>
      </div>

      <div className="flex w-full flex-col gap-4">
        {section.questions.map((question, index) => {
          const negativeMarkText = getNegativeMarkText(question.points);

          return (
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
                <div className="flex shrink-0 items-center gap-2 text-[14px] font-[400] leading-[16px] text-[#747775]">
                  <span>Points: {question.points}</span>
                  {negativeMarkText ? <span>|</span> : null}
                  {negativeMarkText ? <span>Negative marking: {negativeMarkText}</span> : null}
                </div>
              </div>

              <div className="flex w-full flex-col gap-3">
                {question?.options?.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-2 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      disabled={disabled}
                      checked={answerSheet[question.id] === option.id}
                      onChange={() => {
                        setAnswerSheet((currentAnswerSheet) => ({
                          ...currentAnswerSheet,
                          [question.id]: option.id,
                        }));
                      }}
                      className="h-4 w-4 border-[#232A25] text-[#49734F] focus:ring-0"
                    />
                    <span className="text-[16px] font-[400] leading-[125%] text-[#232A25] mb-1">{option.text}</span>
                  </label>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ObjectiveQuestionSectionCard;
